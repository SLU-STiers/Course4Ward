import asyncio
import sys
import types
import unittest
from unittest.mock import patch

import ollama_client


class BatchSummaryIntegrationTests(unittest.TestCase):
    def test_batch_endpoint_groups_orders_and_returns_partial_failures(self):
        request = ollama_client.BatchSummaryRequest.model_validate(
            {
                "variant": "fine_tuned",
                "admissions": [
                    {
                        "admissionId": "admission-1",
                        "admissionDate": "2026-11-01",
                        "orders": [
                            {"id": "order-1", "text": "CBC", "dateCreated": "2026-11-02T08:00:00"},
                            {"id": "order-2", "text": "Vital signs", "dateCreated": "2026-11-02T12:00:00"},
                            {"id": "order-3", "text": "Diet", "dateCreated": "2026-11-03"},
                        ],
                    }
                ],
            }
        )
        generated = [
            ("CBC and vital signs were ordered.", 0.2, None),
            (None, 0.1, "model unavailable"),
        ]

        with patch.object(ollama_client, "generate_summary", side_effect=generated) as generate:
            result = asyncio.run(ollama_client.generate_summary_batch(request))

        self.assertEqual(result.total_groups, 2)
        self.assertEqual(result.successful, 1)
        self.assertEqual(result.failed, 1)
        self.assertEqual([row.group_id for row in result.results], [
            "admission-1-day-2",
            "admission-1-day-3",
        ])
        self.assertEqual(result.results[0].orders[0]["id"], "order-1")
        self.assertFalse(result.results[1].success)
        self.assertEqual(result.results[1].error, "model unavailable")
        self.assertEqual(generate.call_args_list[0].kwargs["model"], ollama_client.FINE_TUNED_MODEL)
        self.assertIn("1. CBC\n2. Vital signs", generate.call_args_list[0].args[0])

    def test_embed_endpoint_returns_vectors_from_embedding_module(self):
        fake_module = types.ModuleType("ollama_embeddings")
        fake_module.EMBED_MODEL_NAME = "test-embedding-model"

        class FakeVectors:
            shape = (2, 3)

            def tolist(self):
                return [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]

        fake_module.embed_texts = lambda texts: FakeVectors()
        request = ollama_client.EmbedRequest(texts=["first", "second"])

        with patch.dict(sys.modules, {"ollama_embeddings": fake_module}):
            response = asyncio.run(ollama_client.embed_endpoint(request))

        self.assertEqual(response.model, "test-embedding-model")
        self.assertEqual(response.dimension, 3)
        self.assertEqual(response.embeddings, [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])


if __name__ == "__main__":
    unittest.main()
