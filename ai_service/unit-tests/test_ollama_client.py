import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import ollama_client
import ollama_embeddings


class OllamaClientUnitTests(unittest.TestCase):
    def test_group_admission_orders_groups_by_local_calendar_date(self):
        admission = ollama_client.AdmissionItem(
            admissionId="admission-1",
            admissionDate="2026-11-01",
            orders=[
                ollama_client.OrderItem(id="1", text="CBC", dateCreated="2026-11-02T08:00:00"),
                ollama_client.OrderItem(id="2", text="Vital signs", dateCreated="2026-11-02T18:00:00"),
                ollama_client.OrderItem(id="3", text="Diet", dateCreated="2026-11-03"),
                ollama_client.OrderItem(id="4", text="Undated"),
            ],
        )

        groups = ollama_client.group_admission_orders(admission)

        self.assertEqual([(day, day_text, len(orders)) for day, day_text, orders in groups], [
            (2, "2026-11-02", 2),
            (3, "2026-11-03", 1),
            (None, None, 1),
        ])

    def test_prompt_includes_reference_style_and_formatting_constraints(self):
        prompt = ollama_client.build_prompt(
            "CBC tomorrow",
            group_label="Day 2 of Admission #admission-1",
            references=[{"approvedSummary": "A prior summary", "sourceOrders": ["Old order"]}],
            instructions="Use a shorter paragraph",
        )

        self.assertIn("Day 2 of Admission #admission-1", prompt)
        self.assertIn("A prior summary", prompt)
        self.assertIn("summarize ONLY the CURRENT orders", prompt)
        self.assertIn("Use a shorter paragraph", prompt)
        self.assertIn("CBC tomorrow", prompt)

    def test_generate_summary_sends_prompt_to_selected_model(self):
        response = SimpleNamespace(
            status_code=200,
            json=lambda: {"message": {"content": "The CBC was obtained."}},
        )
        with patch.object(ollama_client.requests, "post", return_value=response) as post:
            summary, elapsed, error = ollama_client.generate_summary(
                "CBC tomorrow", model="test-model", temperature=0.4
            )

        self.assertEqual(summary, "The CBC was obtained.")
        self.assertGreaterEqual(elapsed, 0)
        self.assertIsNone(error)
        self.assertEqual(post.call_args.kwargs["json"]["model"], "test-model")
        self.assertEqual(post.call_args.kwargs["json"]["options"]["temperature"], 0.4)

    def test_embeddings_load_model_once_and_return_numpy_array(self):
        created_models = []

        class FakeModel:
            def encode(self, texts, **kwargs):
                self.encoded = (texts, kwargs)
                return [[1.0, 0.0]]

        def create_model(path):
            model = FakeModel()
            created_models.append((path, model))
            return model

        fake_transformers = SimpleNamespace(SentenceTransformer=create_model)
        previous_model = ollama_embeddings._model
        ollama_embeddings._model = None
        try:
            with patch.dict(sys.modules, {"sentence_transformers": fake_transformers}):
                first = ollama_embeddings.embed_texts(["CBC"])
                second = ollama_embeddings.embed_texts(["CBC"])
        finally:
            ollama_embeddings._model = previous_model

        self.assertEqual(first.tolist(), [[1.0, 0.0]])
        self.assertEqual(second.tolist(), [[1.0, 0.0]])
        self.assertEqual(len(created_models), 1)
        self.assertTrue(created_models[0][1].encoded[1]["normalize_embeddings"])


if __name__ == "__main__":
    unittest.main()
