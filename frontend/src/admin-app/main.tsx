import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App"
import "./src/index.css"

ReactDOM.createRoot(document.getElementById("admin-app-root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
