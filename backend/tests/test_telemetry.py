import logging
import os
import sys
import unittest
from unittest.mock import MagicMock

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from common.telemetry import (
    TraceClientInterceptor,
    TraceLogFilter,
    configure_service_logger,
    extract_request_id_from_grpc_context,
    generate_request_id,
    get_request_id,
    set_request_id,
    traced_rpc,
)


class TestTelemetry(unittest.TestCase):
    def test_request_id_generation_and_context(self):
        req_id = generate_request_id()
        self.assertTrue(len(req_id) >= 6)
        set_request_id(req_id)
        self.assertEqual(get_request_id(), req_id)

    def test_trace_log_filter_injects_request_id(self):
        filter_instance = TraceLogFilter()
        record = logging.LogRecord("test", logging.INFO, "test.py", 10, "msg", (), None)

        set_request_id("")
        filter_instance.filter(record)
        self.assertEqual(record.request_id, "[-]")

        set_request_id("abc12345")
        filter_instance.filter(record)
        self.assertEqual(record.request_id, "[abc12345]")

    def test_configure_service_logger(self):
        logger = configure_service_logger("TestService")
        self.assertEqual(logger.name, "TestService")
        self.assertFalse(logger.propagate)
        self.assertTrue(any(isinstance(f, TraceLogFilter) for h in logger.handlers for f in h.filters))

    def test_extract_request_id_from_grpc_context(self):
        # When context is None
        new_id = extract_request_id_from_grpc_context(None)
        self.assertTrue(bool(new_id))

        # When context has metadata
        mock_context = MagicMock()
        mock_context.invocation_metadata.return_value = [
            ("user-agent", "grpc-python"),
            ("x-request-id", "trace-xyz-99"),
        ]
        extracted = extract_request_id_from_grpc_context(mock_context)
        self.assertEqual(extracted, "trace-xyz-99")

    def test_traced_rpc_decorator_success(self):
        class DummyServicer:
            logger = logging.getLogger("Dummy")

            @traced_rpc("DoSomething")
            def DoSomething(self, request, context):
                return f"processed: {request.val}"

        servicer = DummyServicer()
        mock_req = MagicMock(val="criticbox")
        mock_ctx = MagicMock()
        mock_ctx.invocation_metadata.return_value = [("x-request-id", "test-rpc-123")]

        result = servicer.DoSomething(mock_req, mock_ctx)
        self.assertEqual(result, "processed: criticbox")
        self.assertEqual(get_request_id(), "test-rpc-123")

    def test_traced_rpc_decorator_exception(self):
        class DummyServicer:
            logger = logging.getLogger("Dummy")

            @traced_rpc("FailMethod")
            def FailMethod(self, request, context):
                raise ValueError("Erro intencional")

        servicer = DummyServicer()
        with self.assertRaises(ValueError):
            servicer.FailMethod(MagicMock(), None)

    def test_trace_client_interceptor_attaches_metadata(self):
        set_request_id("client-trace-777")
        interceptor = TraceClientInterceptor()

        mock_call_details = MagicMock()
        mock_call_details.method = "/service/method"
        mock_call_details.timeout = 5.0
        mock_call_details.metadata = [("header-1", "val-1")]
        mock_call_details.credentials = None
        mock_call_details.wait_for_ready = None

        captured_details = None

        def continuation(details, request):
            nonlocal captured_details
            captured_details = details
            return "ok"

        res = interceptor.intercept_unary_unary(continuation, mock_call_details, "req")
        self.assertEqual(res, "ok")
        self.assertIsNotNone(captured_details)
        metadata_dict = dict(captured_details.metadata)
        self.assertEqual(metadata_dict.get("x-request-id"), "client-trace-777")
