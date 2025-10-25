#!/usr/bin/env python3
"""
Utility script to batch import vector references from log file to database.
Example usage:
    python import_vector_refs.py --dry-run
    python import_vector_refs.py --limit 1000
    python import_vector_refs.py --log-file /path/to/custom/logfile.log
"""

import sys
import os
import json
import logging
import argparse
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Initialize basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def batch_import_vector_references(log_file_path=None, limit=None, dry_run=False):
    """
    Batch import vector references from log file to database.
    Useful for periodically populating the admin interface with processed chunk info.

    Args:
        log_file_path: Path to log file (default: data/logs/vector_references.log)
        limit: Maximum number of entries to process (default: None = all)
        dry_run: If True, parse and validate but don't insert to database

    Returns:
        dict: Summary of processed entries
    """
    from modules.database import db, VectorReference

    if log_file_path is None:
        log_file_path = os.path.join("data", "logs", "vector_references.log")

    if not os.path.exists(log_file_path):
        logging.warning(f"Vector reference log file not found: {log_file_path}")
        return {"entries_processed": 0, "entries_skipped": 0, "entries_failed": 0}

    logging.info(f"Starting batch import of vector references from {log_file_path}")

    processed_count = 0
    skipped_count = 0
    failed_count = 0
    log_entries = []

    # Read and parse log file
    try:
        with open(log_file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                if limit and line_num > limit:
                    break

                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)
                    log_entries.append(entry)
                except json.JSONDecodeError as e:
                    logging.warning(f"Skipping malformed JSON at line {line_num}: {e}")
                    failed_count += 1
                    continue

    except Exception as e:
        logging.error(f"Error reading log file {log_file_path}: {e}")
        return {"entries_processed": 0, "entries_skipped": 0, "entries_failed": 1}

    # Check for existing references to avoid duplicates
    existing_refs = set()
    try:
        existing_records = VectorReference.query.with_entities(
            VectorReference.file_id, VectorReference.url_download_id, VectorReference.chunk_index
        ).all()
        existing_refs = {(r.file_id, r.url_download_id, r.chunk_index) for r in existing_records}
    except Exception as e:
        logging.warning(f"Could not query existing vector references: {e}")

    # Process entries
    for entry in log_entries:
        try:
            file_id = entry.get("file_id")
            url_download_id = entry.get("url_download_id")
            chunk_index = entry.get("chunk_index")

            # Basic validation
            if file_id is None and url_download_id is None:
                logging.warning(f"Skipping entry - both file_id and url_download_id are None: {entry}")
                skipped_count += 1
                continue

            if chunk_index is None:
                logging.warning(f"Skipping entry - chunk_index is None: {entry}")
                skipped_count += 1
                continue

            # Check for duplicates
            ref_key = (file_id, url_download_id, chunk_index)
            if ref_key in existing_refs:
                logging.debug(f"Skipping duplicate vector reference: {ref_key}")
                skipped_count += 1
                continue

            if not dry_run:
                # Create database record
                new_ref = VectorReference(
                    file_id=file_id,
                    url_download_id=url_download_id,
                    chunk_index=chunk_index
                )
                db.session.add(new_ref)
                existing_refs.add(ref_key)  # Prevent duplicates in same batch

            processed_count += 1

        except Exception as e:
            logging.error(f"Error processing log entry {entry}: {e}")
            failed_count += 1
            continue

    # Commit changes if not dry run
    if not dry_run and processed_count > 0:
        try:
            db.session.commit()
            logging.info(f"Successfully committed {processed_count} vector references to database")
        except Exception as e:
            db.session.rollback()
            logging.error(f"Failed to commit batch: {e}")
            failed_count += processed_count
            processed_count = 0

    summary = {
        "entries_processed": processed_count,
        "entries_skipped": skipped_count,
        "entries_failed": failed_count,
        "dry_run": dry_run
    }

    logging.info(f"Batch import completed: {summary}")
    return summary

def main():
    """Command line interface for the batch import utility."""
    parser = argparse.ArgumentParser(description="Batch import vector references from log file to database")
    parser.add_argument("--log-file", help="Path to log file (default: data/logs/vector_references.log)")
    parser.add_argument("--limit", type=int, help="Maximum number of entries to process")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate but don't insert to database")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        result = batch_import_vector_references(
            log_file_path=args.log_file,
            limit=args.limit,
            dry_run=args.dry_run
        )

        print("=" * 50)
        print("BATCH IMPORT SUMMARY")
        print("=" * 50)
        for key, value in result.items():
            print(f"{key}: {value}")

        if result["entries_failed"] > 0:
            print("\n⚠️  Some entries failed to process. Check logs for details.")
            return 1
        else:
            print("\n✅ Batch import completed successfully!")
            return 0

    except Exception as e:
        logging.error(f"Batch import failed with error: {e}")
        print(f"\n❌ Batch import failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
