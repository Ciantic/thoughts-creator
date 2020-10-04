# My blog generator

1. Read all input files: articles, resources and pages
2. Create database
3. Create output directory
4. Write articles, resources and pages to the output directory

This cannot be done in streamed fashion because database is required to write output files. Having database done before startin to write allows to do additional navigation like next and previous article, latest article list in the sidebar etc.
