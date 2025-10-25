from sqlalchemy import create_engine, inspect

engine = create_engine("sqlite:///data/app.db")
inspector = inspect(engine)
print("Tables in the database:")
for table_name in inspector.get_table_names():
    print(table_name)
