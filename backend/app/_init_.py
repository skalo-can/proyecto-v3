import os
print(">>> DEBUG 1: app/__init__ importado, existe app/static?:",
      os.path.exists(os.path.join(os.path.dirname(__file__), "static")))