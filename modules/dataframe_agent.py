# /home/mlk/flaskrag3/modules/dataframe_agent.py
import io
import logging
import pandas as pd
from typing import TypedDict, Optional, List, Annotated, Sequence, Any, Dict
import operator # For Annotated
from uuid import uuid4

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage, BaseMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import tools_condition # Import standard tools_condition

from pydantic import BaseModel, Field as PydanticField

# Assuming toolkits.pandas_tools is in a place Python can find it, e.g., project root or PYTHONPATH
# If flaskrag3 is your project root, and toolkits is a subdir:
from toolkits.pandas_tools import load_data_to_dataframe as load_df_from_string, get_pandas_repl_tool
from modules.callbacks import UsageMetadataCallbackHandler # Import the callback
from toolkits.dataframe_management_tools import list_loaded_dataframes_tool, set_active_dataframe_tool # Import new management tools
from toolkits.charting_tools import generate_chart_from_df as generate_chart_from_dataframe_tool # Import new tool

class DataFrameAgentState(TypedDict):
    input: str
    chat_history: List[BaseMessage]
    messages: Annotated[Sequence[BaseMessage], operator.add]
    uploaded_file_content: Optional[str]
    uploaded_file_type: Optional[str]
    uploaded_file_name: Optional[str]
    active_dataframe_json: Optional[str]
    dataframe_summary: Optional[str]
    final_answer: Optional[str]
    usage_metadata: Optional[Dict[str, Any]] # For token usage by this agent's LLM calls
    chart_image_base64: Optional[str] 
    chart_image_mime_type: Optional[str]
    # For multi-DF support, passed from Supervisor
    all_loaded_dataframes_info: Optional[Dict[str, str]] # Simplified {id: name} map for LLM context
    # For signaling back to Supervisor
    newly_loaded_df_details: Optional[Dict[str, Any]] # To pass all details of a newly loaded DF
    switched_active_df_id: Optional[str] # To signal which DF was made active
    proactive_questions: Optional[List[str]] # For suggesting next questions

class LoadDataInput(BaseModel):
    data_type: Optional[str] = PydanticField(None, description=(
        "Optional. The type of the data to load, e.g., 'csv', 'tsv', 'excel_base64'. "
        "If not provided, the system will attempt to use the type of the most recently uploaded/pasted file for this turn."
    ))
    data_string: Optional[str] = PydanticField(None, description="This field is for system use. You do not need to provide the data string, only the data_type.")

@tool("load_data_to_active_dataframe", args_schema=LoadDataInput)
def load_data_to_active_dataframe_tool(data_type: str, data_string: Optional[str] = None) -> str:
    """
    Instructs the system to load data from a previously uploaded file or pasted clipboard content into an active DataFrame.
    Use this tool when the user asks to analyze a new file or pasted data that has just been provided for the current turn.
    You can optionally specify the 'data_type' (e.g., 'csv', 'tsv', 'excel_base64'). If you don't, the system will use the detected type of the uploaded/pasted file.
    The system will automatically use the available uploaded/pasted data content.
    Returns a confirmation message. A summary of the loaded DataFrame will be provided if successful.
    """
    # This tool's main job is to signal the intent. The actual loading happens in execute_dataframe_tools.
    return f"Instruction to load data of type '{data_type}' received. The system will attempt to load it."

def create_dataframe_agent_graph(llm: Any): # llm will be passed from agent.py
    df_workflow = StateGraph(DataFrameAgentState)

    def call_dataframe_agent_model(state: DataFrameAgentState):
        logging.info("--- Calling DataFrame Agent Model ---")
        messages_in_state = state.get('messages', [])
        
        df_system_prompt = """You are a data analysis assistant.
Your primary goal is to help the user analyze data from an uploaded file or pasted content.

WORKFLOW:
**RULE 1 (OVERRIDE ALL OTHERS): Processing Newly Uploaded/Pasted Data for the CURRENT TURN**
- The system will explicitly tell you if `uploaded_file_content` is available for THIS TURN. This means a new file was just uploaded or data pasted by the user for THIS specific interaction.
    -   **IF `uploaded_file_content` IS AVAILABLE FOR THIS TURN (the system will tell you this):**
        **AND** the user's query is about analyzing, loading, or understanding this new data (e.g., "analyze this", "load this file", "what's in this data?", "summarize this dataset", "process this csv", "tell me about this data"),
    -   **THEN YOUR ONLY AND IMMEDIATE ACTION MUST BE to call the `load_data_to_active_dataframe_tool`.**
    -   **IGNORE any 'Active DataFrame Summary' from previous turns in this specific scenario.** Your focus is solely on the new data provided for this turn.
  -   Do NOT refer to any previously active DataFrame summary in this scenario. Focus solely on loading the new data provided for this turn.
    -   You can optionally provide the `data_type` argument to this tool if you can confidently infer it. Otherwise, call the tool without `data_type`; the system will use the detected type.
    -   This newly loaded data will automatically become the new active DataFrame.
    -  After calling the tool, your response should confirm the new data is loaded and provide its summary.

**IF RULE 1 DOES NOT APPLY (i.e., no new `uploaded_file_content` for this turn OR the user's query is NOT about analyzing new data for this turn), THEN proceed with the following rules:**
**OTHER CONTEXT (Information provided to you by the system):**
- An 'Active DataFrame Summary' may also be provided by the system. This refers to a DataFrame that was loaded in a PREVIOUS interaction and is still considered active in the session.
- A list of 'All Loaded DataFrames' (with their names and IDs) may also be provided. This tells you what datasets are available in the session.

**DECISION LOGIC (Follow in this order of priority IF NOT PROCESSING A NEW UPLOAD AS PER ABOVE):**

**RULE 2: Handling Tool Execution Errors (Applies AFTER a tool has been called and returned an error)**
- **IF a tool you previously called (like `PandasDataFrameQueryTool` or `generate_chart_from_dataframe`) returns a `ToolMessage` indicating an error (e.g., "Error: Failed to generate chart...", "Error querying DataFrame..."):**
    -   **DO NOT immediately try to call the same tool again with the same or very similar arguments.**
    -   Your response to the user should:
        1.  Acknowledge the error (e.g., "I encountered an issue trying to generate the chart: [error message from tool]").
        2.  Ask the user for clarification, to simplify the request, or to suggest an alternative approach. For example: "Could you describe the chart you want in simpler terms?" or "Perhaps we can try a different type of plot?"

1.  **Handling Complex Operations (e.g., Joins, Merges between loaded DataFrames):**
    - If the user asks to combine or relate data from multiple loaded DataFrames (e.g., "join employees with departments", "merge sales and customer data"):
        1.  **Identify the DataFrames:** Use the `list_loaded_dataframes` tool if you are unsure which DataFrames the user means or if they haven't specified IDs. The tool will provide you with the names and IDs of all loaded DataFrames.
        2.  **Identify Common Columns/Keys:** Think about potential common columns between the target DataFrames that could be used for joining/merging. You might need to inspect the columns of each DataFrame (e.g., by using `df.columns.tolist()` on the active DataFrames one by one, after switching to them using `set_active_dataframe` if necessary).
        3.  **Clarify Join Conditions with User:** If the join columns or the type of join (inner, left, outer, right) are not explicitly stated by the user or are ambiguous, **YOU MUST ASK THE USER FOR CLARIFICATION BEFORE ATTEMPTING THE JOIN.** For example: "To join these DataFrames, which columns should I use as the key? And what type of join would you like (e.g., only matching rows, all rows from the first DataFrame, etc.)?"
        4.  **Formulate Pandas Command:** Once clarified, construct the `pd.merge()` or `pd.concat()` command. Ensure you are operating on the correct DataFrame variables (you may need to load them into temporary variables like `df1`, `df2` within your Pandas command context if the tool executes in a fresh scope for each command).
        5.  **Present Result:** Clearly state how the DataFrames were combined and show a sample of the resulting DataFrame.
    - **Self-Correction and Asking for Help:** If a task is ambiguous, or if a command executed with `PandasDataFrameQueryTool` fails or doesn't produce the expected result after one or two attempts for the same underlying goal, **DO NOT LOOP REPEATEDLY WITH THE SAME OR SLIGHTLY MODIFIED FAILED COMMANDS.** Instead, you should:
        (This specific instruction is now covered by the more general RULE 2 above for tool errors)

2.  **QUERY EXISTING ACTIVE DATAFRAME:**
    -   **IF** a DataFrame is currently active (indicated by 'Active DataFrame Summary'),

3.  **GENERATE CHART (If no new upload is being processed this turn as per step 1):**
    -   **IF `uploaded_file_content` IS NOT being processed this turn**
        **AND** a DataFrame is active
        **AND** the user asks for a chart or visualization,
     -   **THEN** use the 'generate_chart_from_dataframe' to generate the chart.
   - You need to provide the 'python_code_for_chart' argument, which is a string of Python code to execute.
   - After the chart is generated, your final response should be the chart itself, with a simple confirmation message.

4.  **MANAGE DATAFRAMES (If no new upload is being processed this turn as per step 1):**
     -   **If asked about the number of loaded dataframes, or to list them (e.g., "how many dataframes?", "list datasets", "what data is loaded?"), you MUST use the `list_loaded_dataframes` tool first. Then, use the information from the tool's output (which will be a list of dataframe names and IDs provided by the system based on your call) to answer the user accurately.**
        -   To see all loaded datasets: Use `list_loaded_dataframes` tool.
        -   To switch to a different loaded dataset: Use `set_active_dataframe` tool with the `dataframe_id`.

5.  **NO DATA SCENARIO (Fallback):**
    -   If no `uploaded_file_content` is available for this turn, AND no DataFrame is active (no 'Active DataFrame Summary'), AND the user's query doesn't fit other tools, inform the user that no data is loaded and they need to upload a file or paste data.

PRIORITY:
- **New uploads for the current turn, when asked to be analyzed, ALWAYS take precedence (Step 1).**
- If no new upload is being analyzed this turn, then interact with the existing active DataFrame or manage the list of DataFrames.
- If no 'Active DataFrame Summary' is provided and the user asks a question that seems to be about a previously discussed DataFrame, inform them that the data is not currently loaded for this interaction and they might need to provide it again or ask to load it again.

Your final response should be the direct answer or result of the operation.
"""
        if not messages_in_state or not isinstance(messages_in_state[0], SystemMessage):
            messages_for_llm = [SystemMessage(content=df_system_prompt)] + messages_in_state
        else: # Avoid duplicate system messages if re-entering
            messages_for_llm = [SystemMessage(content=df_system_prompt)] + [m for m in messages_in_state if not isinstance(m, SystemMessage)]

        # If a dataframe is already active and a summary exists, prepend it to the messages for context
        # This is in addition to it being in chat_history.
        current_df_summary = state.get("dataframe_summary")
        all_loaded_dfs_info = state.get("all_loaded_dataframes_info") # {id: name}
        new_upload_available_for_turn = bool(state.get("uploaded_file_content")) # True if new file for this turn
        
         # Inject context about new upload *first* if available
        if new_upload_available_for_turn:
            new_upload_filename = state.get("uploaded_file_name") or "newly uploaded data"
            new_upload_context_message = SystemMessage(content=f"SYSTEM CONTEXT: New `uploaded_file_content` (for '{new_upload_filename}') IS available for THIS turn. If the user asks to analyze it, prioritize loading it using `load_data_to_active_dataframe_tool` as per RULE 1.")
            messages_for_llm.insert(1, new_upload_context_message) # Insert right after main system prompt

        # Only add active DF summary if no new upload is being prioritized for loading
        if not new_upload_available_for_turn and current_df_summary and state.get("active_dataframe_json"):
            active_df_context_message = SystemMessage(content=f"CONTEXT: An Active DataFrame Summary is provided below. Use this for the current query if relevant (and RULE 1 does not apply).\n--- Active DataFrame Summary ---\n{current_df_summary}\n--- End of Active DataFrame Summary ---")
            messages_for_llm.insert(2 if new_upload_available_for_turn else 1, active_df_context_message)
        
        if all_loaded_dfs_info and len(all_loaded_dfs_info) > 0:
            loaded_dfs_str = ", ".join([f"{name} (ID: {id})" for id, name in all_loaded_dfs_info.items()])
            loaded_dfs_context_message = SystemMessage(content=f"CONTEXT: Currently loaded DataFrames available in this session: {loaded_dfs_str}. The active one (if any) is detailed in 'Active DataFrame Summary'.")
            messages_for_llm.insert(3 if new_upload_available_for_turn and current_df_summary else (2 if new_upload_available_for_turn or current_df_summary else 1), loaded_dfs_context_message)

        df_tools_list = [load_data_to_active_dataframe_tool, list_loaded_dataframes_tool, set_active_dataframe_tool] # Base tools + management tools
        if state.get("active_dataframe_json"):
            logging.info("[DataFrame Agent] DataFrame is active, adding Pandas REPL tool.")
            active_df_for_tool = pd.read_json(io.StringIO(state["active_dataframe_json"] ), orient='split')
            pandas_repl_tool = get_pandas_repl_tool(df=active_df_for_tool, tool_description="Query the active DataFrame using Python/Pandas code. DataFrame is 'df'.")
            df_tools_list.append(generate_chart_from_dataframe_tool) # Add chart tool when DF is active
            df_tools_list.append(pandas_repl_tool)
        
        llm_with_df_tools = llm.bind_tools(df_tools_list)
        callback_handler = UsageMetadataCallbackHandler() # Initialize callback
        response = llm_with_df_tools.invoke(messages_for_llm, config={"callbacks": [callback_handler]})
        logging.info(f"[DataFrame Agent] LLM Raw Response: {response}")
        
        proactive_questions_to_generate = []
        
        # Prioritize usage data from the callback handler as it's explicitly populated
        current_usage = callback_handler.usage_metadata
        if not current_usage: # Fallback if callback didn't populate for some reason
            logging.warning("[DataFrame Agent] Callback handler did not populate usage_metadata. Falling back to response.response_metadata.")
            current_usage = response.response_metadata.get("usage_metadata", {}) # Direct from response if available
            if not current_usage.get("model") and hasattr(response, 'response_metadata') and response.response_metadata.get("model_name"):
                 current_usage["model"] = response.response_metadata.get("model_name")
        logging.info(f"[DataFrame Agent] Usage metadata being set for state: {current_usage}")
        
        if not response.tool_calls: # If LLM provides a direct answer
            return {"messages": [response], "final_answer": response.content, "usage_metadata": current_usage}
        return {"messages": [response], "usage_metadata": current_usage} # Else, return response with tool calls and usage

    def execute_dataframe_tools(state: DataFrameAgentState):
        logging.info("--- Executing DataFrame Tools ---")
        last_message = state['messages'][-1]
        if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
            return {} # No tools to execute

        tool_messages = []
        updated_state_elements = {} 
        updated_state_elements["chart_image_base64"] = None # Reset chart for this turn
        updated_state_elements["chart_image_mime_type"] = None
        updated_state_elements["newly_loaded_df_details"] = None # Reset for this turn
        updated_state_elements["switched_active_df_id"] = None # Reset for this turn
        # Preserve usage_metadata from the previous LLM call if tools are executed
        updated_state_elements["usage_metadata"] = state.get("usage_metadata")
        
        for tool_call in last_message.tool_calls:
            tool_name = tool_call['name']
            tool_args = tool_call['args']
            tool_call_id = tool_call['id']
            logging.info(f"[DataFrame Agent] Tool: {tool_name}, Args: {tool_args}")

            if tool_name == "load_data_to_active_dataframe":
                # Use data_type from LLM if provided, otherwise fallback to state.uploaded_file_type
                llm_provided_data_type = tool_args.get("data_type")
                effective_data_type = llm_provided_data_type if llm_provided_data_type else state.get("uploaded_file_type")
                
                data_content = state.get("uploaded_file_content") # Get from DataFrameAgentState
                if not data_content or not effective_data_type:
                    tool_messages.append(ToolMessage(content=f"Error: System could not find data content, or the data type ('{effective_data_type}') was not specified or detected for loading.", name="load_data_to_active_dataframe_tool", tool_call_id=tool_call_id))
                    continue
                try:
                    # Use the imported load_df_from_string
                    df = load_df_from_string(data_content, effective_data_type) 
                    df_json = df.to_json(orient='split', date_format='iso')
                    summary_buffer = io.StringIO()
                    df.info(buf=summary_buffer)
                    df_columns = df.columns.tolist()
                    df_dtypes = df.dtypes.astype(str).to_dict()
                    
                    summary = f"DataFrame loaded successfully. Columns: {df_columns}\nHead:\n{df.head().to_string()}\nInfo:\n{summary_buffer.getvalue()}"
                    
                    # For DataFrameAgent's own state for immediate use by LLM
                    updated_state_elements["active_dataframe_json"] = df_json
                    updated_state_elements["dataframe_summary"] = summary
                    
                    # For Supervisor to update its persisted state
                    df_id = f"df_{uuid4().hex[:8]}" # Generate a unique ID
                    # Use the passed filename from state, fallback to type, then generic
                    file_name_for_df = state.get("uploaded_file_name") or state.get("uploaded_file_type") or "loaded_data" 

                    updated_state_elements["newly_loaded_df_details"] = {"id": df_id, "name": file_name_for_df, "json": df_json, "summary": summary, "columns": df_columns, "dtypes": df_dtypes}
                    tool_messages.append(ToolMessage(content=summary, name="load_data_to_active_dataframe_tool", tool_call_id=tool_call_id))
                    updated_state_elements["uploaded_file_content"] = None # Clear after use
                    updated_state_elements["uploaded_file_type"] = None
                except Exception as e:
                    logging.error(f"[DataFrame Agent] Error loading data: {e}", exc_info=True)
                    tool_messages.append(ToolMessage(content=f"Error loading data: {e}", name="load_data_to_active_dataframe_tool", tool_call_id=tool_call_id))
            
            elif tool_name == "PandasDataFrameQueryTool":
                if not state.get("active_dataframe_json"):
                    tool_messages.append(ToolMessage(content="Error: No active DataFrame to query. Please load data first.", tool_call_id=tool_call_id))
                    continue
                try:
                    active_df_for_tool = pd.read_json(io.StringIO(state["active_dataframe_json"]), orient='split')
                    pandas_repl_tool = get_pandas_repl_tool(df=active_df_for_tool) # Tool needs the live DF
                    command = tool_args.get("command", tool_args.get("__arg1", "")) # Handle single arg if LLM sends it that way
                    result = pandas_repl_tool.run(command)
                    tool_messages.append(ToolMessage(content=str(result), name="PandasDataFrameQueryTool", tool_call_id=tool_call_id))
                except Exception as e:
                    logging.error(f"[DataFrame Agent] Error querying DataFrame: {e}", exc_info=True)
                    tool_messages.append(ToolMessage(content=f"Error querying DataFrame: {e}", name="PandasDataFrameQueryTool", tool_call_id=tool_call_id))
            elif tool_name == "generate_chart_from_dataframe":
                if not state.get("active_dataframe_json"):
                    tool_messages.append(ToolMessage(content="Error: No active DataFrame to generate chart from. Load data first.", name="generate_chart_from_dataframe", tool_call_id=tool_call_id))
                    continue
                try:
                    active_df_for_chart = pd.read_json(io.StringIO(state["active_dataframe_json"]), orient='split')
                    chart_code = tool_args.get("python_code_for_chart")
                    # Call the Python function directly, not the Langchain tool's invoke method,
                    # because 'df' is not part of the args_schema for the LLM.
                    # The @tool decorator makes generate_chart_from_dataframe_tool a Runnable.
                    chart_result = generate_chart_from_dataframe_tool.func(python_code_for_chart=chart_code, df=active_df_for_chart)
                    if chart_result.get("error"):
                        tool_messages.append(ToolMessage(content=chart_result["error"], name="generate_chart_from_dataframe", tool_call_id=tool_call_id))
                    else:
                        updated_state_elements["chart_image_base64"] = chart_result.get("chart_image_base64")
                        updated_state_elements["chart_image_mime_type"] = chart_result.get("chart_image_mime_type")
                        tool_messages.append(ToolMessage(content=chart_result.get("message", "Chart generated."), name="generate_chart_from_dataframe", tool_call_id=tool_call_id))
                except Exception as e:
                    logging.error(f"[DataFrame Agent] Error invoking chart generation tool: {e}", exc_info=True)
                    tool_messages.append(ToolMessage(content=f"Error generating chart: {e}", name="generate_chart_from_dataframe", tool_call_id=tool_call_id)) # Added name
            
            elif tool_name == "list_loaded_dataframes":
                # The tool itself doesn't need to do much. The LLM will use 'all_loaded_dataframes_info' from state.
                # This tool call just confirms the LLM's intent.
                tool_messages.append(ToolMessage(content="Request to list DataFrames received. The list will be provided based on available data.", name="list_loaded_dataframes", tool_call_id=tool_call_id))

            elif tool_name == "set_active_dataframe":
                dataframe_id_to_set = tool_args.get("dataframe_id")
                all_dfs_info = state.get("all_loaded_dataframes_info", {}) # {id: name}
                if dataframe_id_to_set and dataframe_id_to_set in all_dfs_info:
                    # Signal to supervisor to switch
                    updated_state_elements["switched_active_df_id"] = dataframe_id_to_set
                    # The DataFrameAgent also needs to update its *own* active_dataframe_json and summary
                    # This requires the supervisor to pass the *full* loaded_dataframes structure, not just names.
                    # For now, we'll assume the supervisor handles re-populating the DF agent's active state on next entry.
                    # Or, the DataFrameAgent needs to be able to fetch the JSON/summary for the new active ID.
                    # This part is tricky. Let's assume for now the LLM will re-query after switching.
                    # A better approach: supervisor passes full loaded_dataframes to DataFrameAgentState.
                    tool_messages.append(ToolMessage(content=f"Attempting to set DataFrame '{all_dfs_info.get(dataframe_id_to_set, dataframe_id_to_set)}' (ID: {dataframe_id_to_set}) as active. The system will confirm.", tool_call_id=tool_call_id))
                else:
                    tool_messages.append(ToolMessage(content=f"Error: DataFrame ID '{dataframe_id_to_set}' not found among loaded DataFrames.", name="set_active_dataframe", tool_call_id=tool_call_id))

        
        
        updated_state_elements["messages"] = tool_messages
        return updated_state_elements

    df_workflow.add_node("df_agent_model", call_dataframe_agent_model)
    df_workflow.add_node("df_tools_executor", execute_dataframe_tools)

    df_workflow.set_entry_point("df_agent_model")
    df_workflow.add_conditional_edges("df_agent_model", tools_condition, {"tools": "df_tools_executor", END: END}) # If model gives final answer, END
    df_workflow.add_edge("df_tools_executor", "df_agent_model") # Loop back to model after tool execution
    return df_workflow.compile() # Compile without checkpointer for this sub-graph, recursion_limit is set at invoke time
