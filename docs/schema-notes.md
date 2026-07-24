# ScamTrace Engine Database Schema Notes

The ScamTrace Engine database was designed to separate raw collected data from processed intelligence records. This structure supports data integrity, troubleshooting, classification, and trend analysis.

## sources

The `sources` table stores information about each public data source used by the system. Examples include Reddit, OpenPhish, ScamHaus, URLhaus, and FTC data sources. This table allows the system to track where each scam report originated.

## raw_reports

The `raw_reports` table stores the original data collected from public APIs and feeds. The raw payload is preserved in JSON format so the original source record can be reviewed if parsing or classification issues occur.

## processed_reports

The `processed_reports` table stores cleaned and normalized scam records. These records include extracted content, normalized URLs, assigned scam categories, confidence scores, and duplicate tracking values.

## scam_categories

The `scam_categories` table defines the scam types used by the classification engine. Examples include phishing, impersonation, financial fraud, delivery scams, crypto scams, romance scams, and tech support scams.

## keywords

The `keywords` table stores important words or phrases extracted from processed scam reports. These keywords support trend detection by identifying repeated terms, companies, payment platforms, and scam themes.

## trend_snapshots

The `trend_snapshots` table stores summary records used to analyze scam patterns over time. Each snapshot can track keyword frequency, category counts, and recurring scam themes for a specific date.

## ingestion_logs

The `ingestion_logs` table records pipeline activity for each data source. It tracks successful runs, failed runs, collected records, inserted records, duplicate counts, and errors. This supports testing, debugging, and system reliability analysis.