import os
print(">>> DEBUG 4: api/__init__ importado, existe app/static?:",
      os.path.exists(os.path.join(os.path.dirname(__file__), "..", "static")))