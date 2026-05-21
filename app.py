import streamlit as st
import os

# CSS 읽기
with open("index.css", "r", encoding="utf-8") as f:
    css = f.read()

# JS 읽기
with open("app.js", "r", encoding="utf-8") as f:
    js = f.read()

# HTML 읽기
with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# CSS, JS를 HTML에 직접 삽입
html = html.replace('<link rel="stylesheet" href="index.css">', f'<style>{css}</style>')
html = html.replace('<script src="app.js"></script>', f'<script>{js}</script>')

st.components.v1.html(html, height=900, scrolling=True)