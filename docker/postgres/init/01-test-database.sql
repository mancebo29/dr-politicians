-- Separate databases for integration and end-to-end tests so they never touch
-- dev data. Their setups drop and recreate the schema on every run.
CREATE DATABASE dr_politicians_test;
CREATE DATABASE dr_politicians_e2e;
