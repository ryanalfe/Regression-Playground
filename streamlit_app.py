"""Retire server uploads; keep the old URL useful without accepting files."""
import streamlit as st

st.set_page_config(page_title="Analyze Your Data | Regression Playground", layout="centered")
st.title("Analyze your data has moved")
st.write(
    "The new analyzer runs in your browser. CSV contents stay on your device, "
    "and you can explore two synthetic datasets without selecting a file."
)
st.link_button("Open the private browser analyzer", "https://ryanalfe.github.io/Regression-Playground/analyze.html", type="primary")
st.caption("Regression Playground · Created by Ryan Alfe")
