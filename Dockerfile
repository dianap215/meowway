FROM python:3.12-slim
WORKDIR /app
COPY main.py ./
COPY hosting ./hosting
RUN python -c "from main import install_engine; install_engine()"
COPY panel ./panel
COPY bridge ./bridge
CMD ["python", "-u", "main.py"]
