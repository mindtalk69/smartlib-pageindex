import re
import logging

def _normalize_question(text: str) -> str:
    cleaned = re.sub(r'^[\s\-\d\.\)\(•\u2022\*]+', '', (text or '').strip())
    return cleaned.rstrip('?.!').strip().lower()

def test_parsing(raw_q_content):
    print(f"Testing raw content:\n{raw_q_content}\n" + "-"*20)
    suggested_questions = []
    
    # Simulate the logic I just added to agent.py
    try:
        import json as _json
        # Extract JSON array if surrounded by chatter
        json_match = re.search(r'\[\s*".*?"\s*(?:,\s*".*?"\s*)*\]', raw_q_content, re.DOTALL)
        if json_match:
            raw_q_content = json_match.group(0)
            print(f"Extracted JSON Match: {raw_q_content}")
        
        stripped = raw_q_content.strip()
        if stripped.startswith('['):
            parsed = _json.loads(stripped)
            if isinstance(parsed, list):
                suggested_questions = [q.strip() for q in parsed if isinstance(q, str)][:3]
        
        if not suggested_questions:
            # Robust line parsing fallback
            for line in raw_q_content.splitlines():
                line = line.strip()
                if not line or len(line) < 10:
                    continue
                # Skip common conversational intros
                if any(intro in line.lower() for intro in ["certainly", "here are", "suggested", "follow-up"]):
                    if not line.endswith('?'):
                        print(f"Skipping chatter line: {line}")
                        continue
                
                # Remove common numbering/bullets and surrounding quotes
                clean = re.sub(r'^[\d\-\.\)\s•\*]+', '', line).strip().strip('"\'').strip()
                if clean and len(clean) > 5:
                    if not clean.endswith('?'):
                        clean += '?'
                    if clean not in suggested_questions:
                        suggested_questions.append(clean)
                    if len(suggested_questions) >= 3:
                        break
    except Exception as e:
        print(f"Error parsing: {e}")
    
    print(f"Final suggested questions: {suggested_questions}")
    return suggested_questions

# Test Case 1: The noisy logs case
noise_content = """Certainly! Here are 3 specific follow-up questions based on the provided documents:

1. Regarding the real-time charger status information powered by Bluelink (Document 1), can you clarify how users access this information and whether it is available both in the vehicle and remotely via a mobile app?

2. In Document 2, the Vehicle Health Report and Diagnostic Report are mentioned—what specific parameters are monitored, and how frequently are these reports generated or updated?

3. Document 3 references setting a charging limit and scheduling charging—does the system allow for dynamic adjustment based on energy consumption patterns or electricity rates, and how is this managed by the user?"""

res1 = test_parsing(noise_content)
assert "Certainly!" not in res1[0]
assert len(res1) == 3

# Test Case 2: Mixed JSON and chatter
mixed_content = """Here is your JSON:
["What is the range?", "How to charge?", "Where is the manual?"]
Hope this helps!"""

res2 = test_parsing(mixed_content)
assert len(res2) == 3
assert res2[0] == "What is the range?"

print("\nAll tests passed!")
