import numpy as np
import pandas as pd
import statsmodels.api as sm


def fit_regression(data, response_column, predictor_columns):
    """Fit a linear regression using selected numeric columns."""

    # Validate the visitor's selections.
    if not predictor_columns:
        raise ValueError("Select at least one predictor.")

    if response_column in predictor_columns:
        raise ValueError(
            "The outcome cannot also be a predictor."
        )

    if len(set(predictor_columns)) != len(predictor_columns):
        raise ValueError("Each predictor must be selected only once.")

    if not data.columns.is_unique:
        raise ValueError("The dataset must have unique column names.")

    selected_columns = [response_column] + predictor_columns

    missing_columns = [
        column for column in selected_columns
        if column not in data.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Columns not found: {', '.join(missing_columns)}"
        )

    # Clean only the columns used in this model.
    numeric_data = data[selected_columns].apply(
        pd.to_numeric,
        errors="coerce",
    )

    numeric_data = numeric_data.replace(
        [np.inf, -np.inf],
        np.nan,
    )

    clean_data = numeric_data.dropna()

    rows_used = len(clean_data)
    rows_excluded = len(data) - rows_used

    # One parameter per predictor, plus the intercept.
    parameter_count = len(predictor_columns) + 1

    if rows_used <= parameter_count:
        raise ValueError(
            "Not enough complete rows. You need more observations "
            "than predictors plus the intercept."
        )

    y = clean_data[response_column]
    X = clean_data[predictor_columns]

    if y.nunique() < 2:
        raise ValueError("The outcome must contain different values.")

    constant_predictors = [
        column for column in predictor_columns
        if X[column].nunique() < 2
    ]

    if constant_predictors:
        raise ValueError(
            "These predictors do not vary: "
            + ", ".join(constant_predictors)
        )

    X = sm.add_constant(X, has_constant="add")

    if np.linalg.matrix_rank(X.to_numpy()) < X.shape[1]:
        raise ValueError(
            "Some predictors are perfectly redundant. "
            "Remove a redundant predictor and try again."
        )

    # Fit ordinary least squares with an intercept.
    model = sm.OLS(y, X, missing="raise").fit()

    # Build a readable coefficient table.
    intervals = model.conf_int()

    coefficient_table = pd.DataFrame({
        "Coefficient": model.params,
        "Standard error": model.bse,
        "P-value": model.pvalues,
        "95% CI lower": intervals.iloc[:, 0],
        "95% CI upper": intervals.iloc[:, 1],
    })

    # Keep observed values, predictions, and residuals together.
    diagnostics = pd.DataFrame({
        "Observed": y,
        "Predicted": model.fittedvalues,
        "Residual": model.resid,
    })

    # Return results rather than printing them.
    return {
        "model": model,
        "coefficients": coefficient_table,
        "diagnostics": diagnostics,
        "rows_used": rows_used,
        "rows_excluded": rows_excluded,
        "r_squared": model.rsquared,
        "adjusted_r_squared": model.rsquared_adj,
        "training_rmse": float(
            np.sqrt(np.mean(model.resid ** 2))
        ),
    }