import unittest

import fitz

from app.pdf_extraction import extract_pdf_regions


class PdfExtractionTests(unittest.TestCase):
    def test_extracts_basic_layout_chunks(self):
        pdf_bytes = self._basic_pdf()

        result = extract_pdf_regions(pdf_bytes)
        chunk_types = {chunk.chunkType for chunk in result.chunks}

        self.assertEqual(result.totalPagesProcessed, 2)
        self.assertIn("header", chunk_types)
        self.assertIn("paragraph", chunk_types)
        self.assertIn("footnote", chunk_types)
        self.assertIn("footer", chunk_types)
        self.assertTrue(all(chunk.bbox.x1 > chunk.bbox.x0 for chunk in result.chunks))
        self.assertTrue(all(chunk.bbox.y1 > chunk.bbox.y0 for chunk in result.chunks))

    def test_extracts_ruled_table(self):
        pdf_bytes = self._table_pdf()

        result = extract_pdf_regions(pdf_bytes)
        tables = [chunk for chunk in result.chunks if chunk.chunkType == "table"]

        self.assertEqual(len(tables), 1)
        self.assertIn("Revenue | $100", tables[0].content)
        self.assertEqual(tables[0].metadata["source"], "pdfplumber")

    def test_rejects_invalid_pdf(self):
        with self.assertRaises(ValueError):
            extract_pdf_regions(b"not a pdf")

    def _basic_pdf(self) -> bytes:
        doc = fitz.open()

        for page_number in range(1, 3):
            page = doc.new_page(width=612, height=792)
            page.insert_text((72, 36), "ACME 10-K Annual Report", fontsize=10)
            page.insert_text(
                (72, 120),
                f"This is paragraph text on page {page_number}. It describes filing content.",
                fontsize=12,
            )
            page.insert_text((72, 690), "1. This is a small footnote near the bottom.", fontsize=8)
            page.insert_text((300, 760), str(page_number), fontsize=10)

        return doc.tobytes()

    def _table_pdf(self) -> bytes:
        doc = fitz.open()
        page = doc.new_page(width=612, height=792)

        for x in [72, 180, 288]:
            page.draw_line((x, 120), (x, 200), color=(0, 0, 0), width=1)
        for y in [120, 160, 200]:
            page.draw_line((72, y), (288, y), color=(0, 0, 0), width=1)

        page.insert_text((85, 145), "Metric", fontsize=10)
        page.insert_text((195, 145), "Value", fontsize=10)
        page.insert_text((85, 185), "Revenue", fontsize=10)
        page.insert_text((195, 185), "$100", fontsize=10)

        return doc.tobytes()


if __name__ == "__main__":
    unittest.main()
