import pandas as pd
# from pandas import DataFrame # DataFrame is pd.DataFrame, so not strictly needed as separate import
from langchain_experimental.tools import PythonAstREPLTool
from langchain.tools import Tool
import io # For reading string data
import base64 # For Excel handling

def get_pandas_repl_tool(df: pd.DataFrame, tool_name: str = "PandasDataFrameQueryTool", tool_description: str = None) -> Tool:
    """
    Creates a Python REPL tool that can operate on the provided DataFrame.
    The DataFrame will be available in the REPL's local scope as 'df'.
    """
    if tool_description is None:
        tool_description = (
            "A Python REPL. Use this to execute python commands on a pandas DataFrame named 'df'. "
            "The input should be a valid python command. "
            "For example, to see the first 5 rows, input 'print(df.head())'. "
            "To get column names, input 'print(df.columns)'. "
            "This tool is best for complex queries, data manipulation, or when you need to see the structure of the dataframe. "
            "Only use this tool if a DataFrame has been loaded from a user-provided file or clipboard content."
        )
    # Provide an empty DataFrame if df is None to prevent PythonAstREPLTool init error,
    # though the agent should ideally only make this tool active/callable when df is valid.
    active_df_for_tool = df if df is not None else pd.DataFrame()

    return PythonAstREPLTool(
        locals={"df": active_df_for_tool}, # Makes the DataFrame available as 'df' in the tool's execution environment
        name=tool_name,
        description=tool_description
    )

def load_data_to_dataframe(data_string: str, data_type: str = "csv") -> pd.DataFrame:
    """
    Loads data from a string into a Pandas DataFrame.
    data_type can be 'csv', 'tsv', or 'excel_base64'.
    For 'excel_base64', data_string should be a base64 encoded string of the excel file.
    """
    if data_type == "csv":
        return pd.read_csv(io.StringIO(data_string))
    elif data_type == "tsv": # For clipboard data often in TSV format
        return pd.read_csv(io.StringIO(data_string), sep='\t')
    elif data_type == "excel_base64":
        excel_bytes = base64.b64decode(data_string)
        # Try common Excel extensions if read_excel fails without engine
        try:
            return pd.read_excel(io.BytesIO(excel_bytes))
        except ValueError as e: # Often 'Excel file format cannot be determined'
            return pd.read_excel(io.BytesIO(excel_bytes), engine='openpyxl')
    else:
        raise ValueError(f"Unsupported data_type: {data_type}. Supported types are 'csv', 'tsv', 'excel_base64'.")
