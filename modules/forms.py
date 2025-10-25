from flask_wtf import FlaskForm
from wtforms import StringField, BooleanField, SubmitField
from wtforms.validators import DataRequired, Optional

class VisualGroundingSettingsForm(FlaskForm):
    visual_grounding_enabled = BooleanField('Globally Enable Visual Grounding Feature')
    visual_grounding_doc_store_path = StringField('Path for Visual Grounding Document Store', validators=[DataRequired()])
    submit = SubmitField('Save Settings')

# Add other forms here if needed in the future
