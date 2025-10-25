#!/bin/bash
set -e

FLASKRAG_DIR="/home/mlk/flaskrag3"
SMARTLIB_DIR="/home/mlk/smartlib"

# ANSI colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting SmartLib project creation...${NC}"

# Phase 1: Create directory structure
echo -e "${YELLOW}Phase 1: Creating directory structure...${NC}"
mkdir -p $SMARTLIB_DIR/{ARMtemplate/docs,docs,migrations,modules,static,templates,scripts,toolkits,tests,data}

# Initialize git repository
echo -e "${YELLOW}Initializing git repository...${NC}"
cd $SMARTLIB_DIR
git init

# Copy agents_for_new_home.md to reference during migration
cp $FLASKRAG_DIR/agents_for_new_home.md $SMARTLIB_DIR/

# Follow the instructions in agents_for_new_home.md to complete the migration
echo -e "${GREEN}Directory structure created and git repository initialized.${NC}"
echo -e "${YELLOW}Please follow the detailed instructions in agents_for_new_home.md to complete the migration.${NC}"
echo -e "${GREEN}The file has been copied to $SMARTLIB_DIR/agents_for_new_home.md for reference.${NC}"
