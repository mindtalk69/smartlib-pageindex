# /home/mlk/flaskrag3/toolkits/dataframe_management_tools.py

from langchain_core.tools import tool
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import logging

class SetActiveDataFrameInput(BaseModel):
    dataframe_id: str = Field(description="The ID or name of the DataFrame to set as active.")

@tool("set_active_dataframe", args_schema=SetActiveDataFrameInput)
def set_active_dataframe_tool(dataframe_id: str) -> str:
    """
    Signals the system to set the specified DataFrame as the active one for subsequent operations.
    The system will confirm if the operation was successful or if the DataFrame ID was not found.
    Use 'list_loaded_dataframes' first to see available DataFrame IDs.
    Example: If 'list_loaded_dataframes' shows 'sales_data_csv (ID: df_123)', you can call this tool with dataframe_id='df_123'.
    """
    logging.info(f"[Tool Call] set_active_dataframe_tool called with dataframe_id: {dataframe_id}")
    # This tool just signals the intent. The actual state change happens in the agent's graph node (DataFrameAgent).
    # The DataFrameAgent will then return a specific key in its state to tell the Supervisor to update active_dataframe_id.
    return f"Instruction to attempt setting DataFrame '{dataframe_id}' as active has been processed by the tool. The system will confirm the outcome."

@tool("list_loaded_dataframes")
def list_loaded_dataframes_tool() -> str:
    """
    Requests a list of all currently loaded DataFrames, including their names and IDs.
    The system will provide this list in its response.
    This tool takes no arguments.
    """
    logging.info("[Tool Call] list_loaded_dataframes_tool called.")
    # This tool also signals intent. The DataFrameAgent's LLM, upon seeing this tool call result,
    # should then formulate its response based on the 'all_loaded_dataframes_info' passed into its state
    # by the supervisor.
    return "Instruction to list loaded DataFrames has been processed by the tool. The system will provide the list."