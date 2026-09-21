import hashlib
import io

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st

from regression import fit_regression


# Set up the browser page.
st.set_page_config(
    page_title="Analyze Your Data | Regression Playground",
    layout="wide",
)

st.title("Analyze your data")

st.write(
    "Upload a CSV, choose an outcome and one or more predictors, "
    "and explore an ordinary least-squares regression."
)

st.caption(
    "This first version supports numeric variables. "
    "Uploaded data is processed by the Python app. "
    "The app does not intentionally save your file to disk."
)

# Let the visitor choose a CSV.
uploaded_file = st.file_uploader(
    "Choose a CSV file",
    type=["csv"],
    max_upload_size=5,
)

if uploaded_file is None:
    st.info("Upload a CSV to begin. You can try practice.csv first.")
    st.stop()

# Read the uploaded bytes.
file_bytes = uploaded_file.getvalue()

# Give different datasets separate widget identities.
dataset_id = hashlib.sha256(file_bytes).hexdigest()

try:
    data = pd.read_csv(
        io.BytesIO(file_bytes),
        nrows=10001,
    )
except (
    pd.errors.EmptyDataError,
    pd.errors.ParserError,
    UnicodeDecodeError,
) as error:
    st.error(
        "We couldn't read this file. Use a comma-separated CSV "
        "with a header row and UTF-8 encoding."
    )
    st.stop()

# Keep this first version small and responsive.
if len(data) > 10000:
    st.error(
        "This version supports up to 10,000 rows. "
        "Please upload a smaller dataset."
    )
    st.stop()

if data.empty:
    st.error("The file has no data rows.")
    st.stop()

st.subheader("1. Preview your dataset")
st.write(f"{len(data):,} rows · {len(data.columns)} columns")
st.dataframe(data.head(10), hide_index=True)

# Offer columns pandas recognizes as numeric.
numeric_columns = data.select_dtypes(
    include="number"
).columns.tolist()

if len(numeric_columns) < 2:
    st.error(
        "You need at least two numeric columns: "
        "one outcome and one predictor."
    )
    st.stop()

st.subheader("2. Choose your variables")

st.caption(
    "Only numeric columns are available. Remove currency symbols "
    "or other text from numeric fields before uploading. "
    "Avoid using ID numbers or category codes as continuous predictors."
)

response_column = st.selectbox(
    "Outcome (y): what do you want to explain?",
    options=numeric_columns,
    key=f"response_{dataset_id}",
)

# Prevent the outcome from also being a predictor.
predictor_options = [
    column
    for column in numeric_columns
    if column != response_column
]

predictor_columns = st.multiselect(
    "Predictors (X): which variables should the model use?",
    options=predictor_options,
    key=f"predictors_{dataset_id}_{response_column}",
)

st.caption(
    "Choose one predictor for simple linear regression, "
    "or several for multiple linear regression."
)

run_analysis = st.button(
    "Run regression",
    type="primary",
    disabled=not predictor_columns,
)

if not run_analysis:
    st.stop()


# Run the reusable analysis function.
try:
    results = fit_regression(
        data=data,
        response_column=response_column,
        predictor_columns=predictor_columns,
    )
except ValueError as error:
    st.error(str(error))
    st.stop()
except np.linalg.LinAlgError:
    st.error(
        "The numerical calculation failed. "
        "Check your data and try fewer predictors."
    )
    st.stop()

st.subheader("3. Model results")

st.write(
    f"Outcome: **{response_column}**  \n"
    f"Predictors: **{', '.join(predictor_columns)}**"
)

st.write(
    f"Rows used: **{results['rows_used']:,}** · "
    f"Rows excluded: **{results['rows_excluded']:,}**"
)

if results["rows_excluded"] > 0:
    st.warning(
        "Rows with missing or invalid values in the selected "
        "columns were excluded. This can affect the results "
        "if the missingness is systematic."
    )

metric_columns = st.columns(3)

metric_columns[0].metric(
    "R²",
    f"{results['r_squared']:.3f}",
)

metric_columns[1].metric(
    "Adjusted R²",
    f"{results['adjusted_r_squared']:.3f}",
)

metric_columns[2].metric(
    "Training RMSE",
    f"{results['training_rmse']:.3f}",
)

st.caption(
    "These measures describe the data used to fit the model. "
    "They do not measure performance on unseen data. "
    "RMSE is expressed in the outcome's units."
)

st.markdown("### Coefficients")

st.dataframe(
    results["coefficients"].style.format("{:.4g}")
)

st.write(
    "Each predictor's coefficient describes the predicted change "
    "in the outcome for a one-unit increase in that predictor, "
    "holding the other included predictors constant."
)

st.caption(
    "The 'const' row is the intercept. Confidence intervals "
    "and p-values use conventional OLS assumptions. "
    "They do not establish causation."
)

st.subheader("4. Diagnostic plots")

diagnostics = results["diagnostics"]

fig, axes = plt.subplots(
    1,
    2,
    figsize=(12, 4),
    constrained_layout=True,
)

# Plot 1: actual versus predicted outcomes.
axes[0].scatter(
    diagnostics["Predicted"],
    diagnostics["Observed"],
    alpha=0.6,
    color="#167f7a",
)

lower = min(
    diagnostics["Predicted"].min(),
    diagnostics["Observed"].min(),
)

upper = max(
    diagnostics["Predicted"].max(),
    diagnostics["Observed"].max(),
)

axes[0].plot(
    [lower, upper],
    [lower, upper],
    linestyle="--",
    color="#4567cd",
)

axes[0].set_title("Observed versus predicted")
axes[0].set_xlabel("Predicted outcome")
axes[0].set_ylabel("Observed outcome")

# Plot 2: residuals versus predicted outcomes.
axes[1].scatter(
    diagnostics["Predicted"],
    diagnostics["Residual"],
    alpha=0.6,
    color="#167f7a",
)

axes[1].axhline(
    0,
    linestyle="--",
    color="#4567cd",
)

axes[1].set_title("Residuals versus predicted")
axes[1].set_xlabel("Predicted outcome")
axes[1].set_ylabel("Residual")

st.pyplot(fig)
plt.close(fig)

st.markdown(
    """
**Observed versus predicted:** Points closer to the dashed
equality line have smaller prediction errors on the fitted data.

**Residuals versus predicted:** Look for curvature, changing
spread, or unusually large errors. These may suggest the model
is missing structure or that some assumptions need investigation.

These plots are useful checks, but they do not establish that
all regression assumptions hold.
"""
)