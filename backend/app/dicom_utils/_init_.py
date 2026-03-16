import os
print(">>> DEBUG 3: dicom_utils/__init__ importado, existe app/static?:",
      os.path.exists(os.path.join(os.path.dirname(__file__), "..", "static")))