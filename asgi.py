from main import app
from a2wsgi import WSGIMiddleware

# Wrap the Flask WSGI app into an ASGI app
asgi_app = WSGIMiddleware(app)
