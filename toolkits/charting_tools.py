# In toolkits/pandas_tools.py or a new charting_tools.py
import matplotlib.pyplot as plt
import io
import base64
import pandas as pd # Assuming df is available
import logging # For logging errors
from langchain_core.tools import tool
from pydantic import BaseModel, Field


class GenerateChartInput(BaseModel):
    python_code_for_chart: str = Field(description=(
        "A string of Python code that uses Matplotlib or Seaborn to generate a chart. "
        "The DataFrame is available as a variable named 'df'. "
        "The code MUST save the plot to an in-memory buffer named 'img_buffer' using "
        "`plt.savefig(img_buffer, format='png', bbox_inches='tight')`. "
        "Do NOT include `plt.show()`."
        "Example: "
        "import matplotlib.pyplot as plt\\n" # LLM needs to know to import if not implicitly provided
        "fig, ax = plt.subplots()\\n"
        "df['your_column_name'].plot(kind='hist', ax=ax, title='Histogram of Your Column')\\n"
        "ax.set_xlabel('Value')\\n"
        "ax.set_ylabel('Frequency')\\n"
        "plt.tight_layout()\\n"
        "plt.savefig(img_buffer, format='png', bbox_inches='tight')"
    ))

@tool("generate_chart_from_dataframe", args_schema=GenerateChartInput)
def generate_chart_from_df(python_code_for_chart: str, df: pd.DataFrame) -> dict:
    """
    Executes Python code to generate a chart from the DataFrame 'df'
    and returns the chart as a base64 encoded image.
    The DataFrame is available as 'df'. The code must use matplotlib or seaborn
    and save the figure to a BytesIO buffer named 'img_buffer' (e.g., plt.savefig(img_buffer, format='png')).
    Do not use plt.show().
    """
    
    logging.info(f"[generate_chart_from_df] Received code: {python_code_for_chart}")
    img_buffer = io.BytesIO()
    try:
        # Create a new figure for each chart to avoid overlap
        fig = plt.figure() # Get a reference to the figure
        
        # Execute the user's code. 'df' and 'plt' should be in scope.
        # WARNING: Executing LLM-generated code is a security risk.
        # Consider sandboxing or structured chart requests for production.
        
         # Provide df, plt, pd, and img_buffer in the execution scope
        exec_globals = {'df': df, 'plt': plt, 'pd': pd, 'img_buffer': img_buffer}
        exec(python_code_for_chart, exec_globals)

        # Ensure the figure associated with the plot is closed after saving
        plt.close(fig) 

        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        return {"chart_image_base64": img_base64, "chart_image_mime_type": "image/png", "message": "Chart generated."}
    except Exception as e:
        logging.error(f"Error generating chart: {e}", exc_info=True)
        if 'fig' in locals() and fig is not None: # Ensure fig was defined
            plt.close(fig) # Ensure figure is closed on error
        return {"error": f"Failed to generate chart: {str(e)}"}
    finally:
        img_buffer.close()
