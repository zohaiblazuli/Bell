FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    clamav clamav-daemon qpdf mupdf-tools poppler-utils ca-certificates \
    && freshclam \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /worker
COPY requirements.txt scanner.py ./
RUN pip install --no-cache-dir -r requirements.txt

RUN groupadd --system bellscanner \
    && useradd --system --gid bellscanner --home-dir /nonexistent --shell /usr/sbin/nologin bellscanner \
    && chown -R bellscanner:bellscanner /worker

ENV SCAN_POLL_SECONDS=5
USER bellscanner
CMD ["python", "scanner.py"]
