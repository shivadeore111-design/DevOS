---
name: jupyter-live-kernel
description: Execute code in a stateful Jupyter kernel session, maintaining variables across cells using hamelnb or jupyter CLI
category: developer
version: 1.0.0
origin: aiden
tags: jupyter, notebook, kernel, python, data-science, ipython, stateful, cells, pandas
---

# Jupyter Live Kernel Execution

Run Python code in a persistent Jupyter kernel so that variables, imports, and state carry over between executions — exactly like working in a notebook, but from the CLI.

## When to Use

- User wants to run data analysis across multiple code cells with shared state
- User wants to explore a dataset step by step
- User wants to run ML training and inspect intermediate results
- User wants to execute a `.ipynb` notebook file from the command line
- User wants to maintain a REPL-like Python session with persistent variables

## How to Use

### 1. Install hamelnb (stateful kernel CLI)

```powershell
pip install hamelnb
# or use jupyter directly
pip install jupyter
```

### 2. Start a kernel and run cells (hamelnb)

```powershell
# Start a persistent kernel session (keeps running between calls)
hamelnb start --name datasession

# Execute a code snippet in the named session
hamelnb run datasession "import pandas as pd; df = pd.read_csv('data.csv'); print(df.shape)"

# Execute next cell — df variable is still available
hamelnb run datasession "print(df.describe())"

# Stop session when done
hamelnb stop datasession
```

### 3. Execute a notebook file

```powershell
# Run all cells in a notebook and save output
jupyter nbconvert --to notebook --execute analysis.ipynb --output analysis_out.ipynb

# Run and convert output to HTML for viewing
jupyter nbconvert --to html --execute analysis.ipynb --output report.html
```

### 4. Run Python code in a Jupyter kernel via Python API

```python
import jupyter_client, queue

km = jupyter_client.KernelManager(kernel_name="python3")
km.start_kernel()
kc = km.client()
kc.start_channels()
kc.wait_for_ready(timeout=30)

def run_cell(code):
  kc.execute(code)
  outputs = []
  while True:
    try:
      msg = kc.get_iopub_msg(timeout=10)
      if msg["msg_type"] == "stream":
        outputs.append(msg["content"]["text"])
      elif msg["msg_type"] == "execute_result":
        outputs.append(msg["content"]["data"].get("text/plain",""))
      elif msg["msg_type"] == "status" and msg["content"]["execution_state"] == "idle":
        break
    except queue.Empty:
      break
  return "".join(outputs)

print(run_cell("import pandas as pd; df = pd.read_csv('data.csv'); df.shape"))
print(run_cell("df.describe()"))   # df is still in scope!
km.shutdown_kernel()
```

### 5. Inject variables into a running kernel

```python
# Use run_cell from step 4 to inject values
run_cell("x = 42; y = [1, 2, 3]")
result = run_cell("print(x * 2, sum(y))")
```

## Examples

**"Load sales.csv and show the top 10 rows, then plot revenue by month"**
→ Use step 4: run cell 1 to load and preview the CSV, run cell 2 to group by month and show results — `df` persists between calls.

**"Execute my analysis.ipynb notebook and give me the output"**
→ Use step 3 with `jupyter nbconvert --to notebook --execute`.

**"Explore the wine quality dataset — check correlations step by step"**
→ Use hamelnb (step 2) to build up analysis iteratively with named session.

## Cautions

- Kernel sessions consume memory for as long as they run — always `km.shutdown_kernel()` when done
- Long-running cells (ML training) will block until complete — set reasonable timeouts
- `nbconvert --execute` re-runs all cells from scratch — it does not resume a previous state
- hamelnb is a third-party tool — verify it is installed with `pip show hamelnb` before use
- Never pass user secrets as inline code strings — use environment variables or config files instead
