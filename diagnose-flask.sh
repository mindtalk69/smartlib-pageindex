# 1. What's in /app?
docker run --rm --entrypoint ls smarthing-app:cpu-latest -la /app/

# 2. Does modules/ exist?
docker run --rm --entrypoint ls smarthing-app:cpu-latest -la /app/modules/

# 3. Does main.py exist?
docker run --rm --entrypoint ls smarthing-app:cpu-latest -la /app/main.py

# 4. Is Flask installed?
docker run --rm --entrypoint pip smarthing-app:cpu-latest list | grep -i flask

# 5. Is gunicorn installed?
docker run --rm --entrypoint which smarthing-app:cpu-latest gunicorn

# 6. Try running the entrypoint (see the actual error!)
docker run --rm -e LOCAL_MODE=true smarthing-app:cpu-latest 2>&1 | head -50

# 7. Try importing your Flask app
docker run --rm --entrypoint python smarthing-app:cpu-latest -c "from main import app; print('Success')"