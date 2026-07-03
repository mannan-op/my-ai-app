import pandas as pd

from app.models.registry import ModelRegistry
from app.schemas.inference import TableRow


class InvalidTableError(ValueError):
    pass


class TableQAService:
    def __init__(self, model_registry: ModelRegistry):
        self.model_registry = model_registry

    def answer_question(self, table: list[TableRow], question: str) -> str:
        dataframe = self._to_dataframe(table)
        model = self.model_registry.get_table_qa_pipeline()
        result = model(table=dataframe, query=question)
        answer = result.get("answer") if isinstance(result, dict) else None

        if not isinstance(answer, str):
            return ""

        return answer

    def _to_dataframe(self, table: list[TableRow]) -> pd.DataFrame:
        if not table:
            raise InvalidTableError("Table must contain at least one row")

        column_names = set(table[0].keys())

        if not column_names:
            raise InvalidTableError("Table rows must contain at least one column")

        for row in table:
            if set(row.keys()) != column_names:
                raise InvalidTableError("All table rows must contain the same columns")

        dataframe = pd.DataFrame(table)

        if dataframe.empty or len(dataframe.columns) == 0:
            raise InvalidTableError("Table must contain at least one row and one column")

        return dataframe.fillna("").astype(str)

