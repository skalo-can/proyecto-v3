import os
print(">>> DEBUG 2: services/__init__ importado, existe app/static?:",
      os.path.exists(os.path.join(os.path.dirname(__file__), "..", "static")))