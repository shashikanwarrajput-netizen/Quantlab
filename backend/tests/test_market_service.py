from __future__ import annotations

from unittest.mock import Mock, patch

import pytest

from backend.services.indian_api_service import IndianAPIError, IndianAPIService


class TestMarketService:
    def test_configuration_status_never_returns_api_key(self):
        service = IndianAPIService(api_key='private-test-key')

        status = service.configuration_status()

        assert status == {
            'provider': 'IndianAPI',
            'configured': True,
            'baseUrl': 'https://stock.indianapi.in',
        }
        assert 'private-test-key' not in str(status)

    def test_api_key_missing_error_is_user_friendly(self):
        service = IndianAPIService(api_key='')

        with pytest.raises(IndianAPIError, match='Market data service is not configured.'):
            service.get_stock_quote('RELIANCE')

    @patch('backend.services.indian_api_service.requests.request')
    def test_quote_uses_documented_parameter_and_provider_fields(self, mock_request):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'RELIANCE': {
                'ltp': '1425.50', 'open': '1410', 'high': '1430', 'low': '1405',
                'close': '1400', 'volume': '12345', 'day_change': '25.50',
                'day_change_percent': '1.82', 'timestamp': '2026-09-28 15:30:00',
            }
        }
        mock_request.return_value = mock_response

        quote = IndianAPIService(api_key='test-key').get_stock_quote('RELIANCE:NSE')

        assert quote['price'] == 1425.5
        assert quote['change'] == 25.5
        assert quote['changePercent'] == 1.82
        assert quote['timestamp'] == '2026-09-28 15:30:00'
        assert mock_request.call_args.kwargs['params'] == {'stock_name': 'RELIANCE'}
        assert mock_request.call_args.kwargs['headers'] == {'X-API-Key': 'test-key'}

    @patch('backend.services.indian_api_service.requests.request')
    def test_history_converts_values_and_sorts_chronologically(self, mock_request):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'datasets': [
                {'metric': 'Price', 'values': [['2026-02-02', '125'], ['2026-01-01', '100']]},
                {'metric': 'DMA50', 'values': [['2026-01-01', '98']]},
                {'metric': 'Volume', 'values': [['2026-01-01', 1000]]},
            ]
        }
        mock_request.return_value = mock_response

        result = IndianAPIService(api_key='test-key').get_historical_data('TCS', '1yr', 'default')

        assert result['data'][0]['datetime'] == '2026-01-01'
        assert result['data'][0]['close'] == 100
        assert result['data'][0]['dma50'] == 98
        assert result['data'][0]['volume'] == 1000
        assert mock_request.call_args.kwargs['params'] == {
            'stock_name': 'TCS', 'period': '1yr', 'filter': 'default',
        }

    def test_rejects_unlisted_period_and_symbols(self):
        service = IndianAPIService(api_key='test-key')
        with pytest.raises(ValueError, match='Unsupported historical period'):
            service.get_historical_data('TCS', '2yr')
        with pytest.raises(IndianAPIError, match='Invalid or unsupported stock symbol'):
            service.get_stock_quote('UNKNOWN')

    @patch('backend.services.indian_api_service.requests.get')
    @patch('backend.services.indian_api_service.requests.request')
    def test_intraday_uses_documented_stock_id_and_preserves_provider_time(self, mock_request, mock_catalog):
        catalog_response = Mock()
        catalog_response.json.return_value = [{'nse-code': 'TCS', 'id': 'S0003051'}]
        mock_catalog.return_value = catalog_response
        api_response = Mock()
        api_response.status_code = 200
        api_response.json.return_value = [{'values': [{'timeStamp': '2026-09-28 09:20:00', 'price': '100.5'}]}]
        mock_request.return_value = api_response

        result = IndianAPIService(api_key='test-key').get_intraday_data('TCS')

        assert result['data'] == [{'time': '2026-09-28 09:20:00', 'price': 100.5}]
        assert mock_request.call_args.args[0] == 'POST'
        assert mock_request.call_args.kwargs['params'] == {'stock_id': 'S0003051'}

    @patch('backend.services.indian_api_service.requests.request')
    def test_batch_quotes_use_documented_body_and_omit_unreturned_symbols(self, mock_request):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'TCS': {'ltp': 100, 'timestamp': '2026-09-28 15:30:00'}}
        mock_request.return_value = mock_response

        quotes = IndianAPIService(api_key='test-key').get_nse_batch_quotes(['TCS', 'INFY'])

        assert len(quotes) == 1
        assert quotes[0]['symbol'] == 'TCS'
        assert mock_request.call_args.kwargs['json'] == {'stock_symbols': ['TCS', 'INFY']}

    @patch('backend.services.indian_api_service.requests.request')
    def test_rate_limit_error_does_not_leak_provider_payload(self, mock_request):
        mock_response = Mock()
        mock_response.status_code = 429
        mock_request.return_value = mock_response

        with pytest.raises(IndianAPIError, match='API request limit reached'):
            IndianAPIService(api_key='test-key').get_stock_quote('INFY')

    @pytest.mark.parametrize(
        ('status_code', 'message'),
        [
            (401, 'Invalid API credentials'),
            (403, 'verify your subscription permissions'),
        ],
    )
    @patch('backend.services.indian_api_service.requests.request')
    def test_provider_auth_and_plan_errors_are_distinct(self, mock_request, status_code, message):
        mock_response = Mock()
        mock_response.status_code = status_code
        mock_request.return_value = mock_response

        with pytest.raises(IndianAPIError, match=message) as error:
            IndianAPIService(api_key='test-key').get_stock_quote('INFY')
        assert error.value.status_code == status_code
