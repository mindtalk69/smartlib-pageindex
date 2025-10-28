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
        "Provide Python code that uses Matplotlib (only) to build a chart. "
        "Seaborn is not installed in this environment, so do not import it. "
        "The DataFrame is available as 'df', and the system will save the active figure after your code runs."
        "Example: "
        "import matplotlib.pyplot as plt\n"
        "fig, ax = plt.subplots()\n"
        "subset = df.head(10)\n"
        "ax.bar(subset['category'], subset['value'])\n"
        "ax.set_xlabel('category')\n"
        "ax.set_ylabel('value')\n"
        "ax.set_title('Example Chart')\n"
        "plt.tight_layout()"
    ))



@tool("generate_chart_from_dataframe", args_schema=GenerateChartInput)
def generate_chart_from_df(python_code_for_chart: str, df: pd.DataFrame) -> dict:
    """
    Executes Python code to generate a chart from the DataFrame 'df'
    and returns the chart as a base64 encoded image.
    The DataFrame is available as 'df'. The code must use matplotlib or seaborn.
    Do not use plt.show(); the system will save the active figure automatically.
    """

    logging.info(f"[generate_chart_from_df] Received code: {python_code_for_chart}")
    img_buffer = io.BytesIO()
    fig = None
    try:
        plt.close('all')
        exec_globals = {'df': df, 'plt': plt, 'pd': pd, 'img_buffer': img_buffer}
        exec(python_code_for_chart, exec_globals)

        if not plt.get_fignums():
            raise RuntimeError("No matplotlib figure was created by the provided code.")

        fig = plt.gcf()
        fig.savefig(img_buffer, format='png', bbox_inches='tight')

        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        return {"chart_image_base64": img_base64, "chart_image_mime_type": "image/png", "message": "Chart generated."}
    except Exception as e:
        logging.error(f"Error generating chart: {e}", exc_info=True)
        if fig is not None:
            plt.close(fig)
        elif plt.get_fignums():
            plt.close('all')
        return {"error": f"Failed to generate chart: {str(e)}"}
    finally:
        if fig is not None and plt.fignum_exists(fig.number):
            plt.close(fig)
        img_buffer.close()
