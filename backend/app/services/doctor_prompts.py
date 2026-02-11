"""
Doctor-Discussion Prompts – safe, non-prescriptive questions for clinicians.
"""

from typing import Dict, List, Optional

def generate_discussion_prompts(risk_analysis: Dict, confidence_analysis: Optional[Dict] = None) -> Dict:
    prompts = {"critical_questions": [], "high_priority_questions": [], "general_questions": [], "follow_up_questions": []}
    abns = risk_analysis.get("abnormalities", {})
    prioritized = risk_analysis.get("prioritized_abnormalities", [])
    clusters = risk_analysis.get("risk_clusters", {}).get("detected_clusters", [])

    for p in prioritized:
        if p.get("priority", {}).get("urgency") == "critical":
            name = p.get("test_name", "")
            if "glucose" in name.lower():
                prompts["critical_questions"].append("My glucose level is significantly elevated. What immediate steps should I take, and do I need emergency care?")
            elif "creatinine" in name.lower():
                prompts["critical_questions"].append("My creatinine suggests possible kidney dysfunction. What does this mean and what follow-up is needed?")
            elif "hemoglobin" in name.lower():
                prompts["critical_questions"].append("My hemoglobin is very low. What are potential causes and treatment options?")

    for p in prioritized:
        if p.get("priority", {}).get("urgency") == "high":
            name = p.get("test_name", "")
            if name.lower() in ["hba1c", "glucose"]:
                prompts["high_priority_questions"].append(f"What lifestyle changes or treatments might help manage my {name.upper()}?")
            elif name.lower() in ["cholesterol", "ldl"]:
                prompts["high_priority_questions"].append(f"My {name.upper()} is high. What dietary or medication options are appropriate?")

    for c in clusters:
        if c.get("pattern_name") == "metabolic_syndrome":
            prompts["high_priority_questions"].append("My results suggest metabolic syndrome. What does this mean for my long-term health?")
        elif c.get("pattern_name") == "diabetes_risk":
            prompts["high_priority_questions"].append("My results indicate elevated diabetes risk. What can I do to prevent or delay it?")

    if abns:
        prompts["general_questions"].append("Can you help me understand what these abnormal lab values mean in context of my overall health?")
        prompts["general_questions"].append("Are there any lifestyle changes I should consider based on these results?")
    if prioritized:
        prompts["follow_up_questions"].append("How often should I repeat these tests to monitor progress?")
        prompts["follow_up_questions"].append("What target ranges should I aim for?")

    if confidence_analysis and confidence_analysis.get("overall_confidence", 1) < 0.6:
        prompts["general_questions"].append("The analysis confidence is lower than ideal. Should we verify values against the original report?")

    risk_level = risk_analysis.get("risk_level", "low")
    if any(prompts["critical_questions"]):
        guidance = "You have critical abnormalities requiring immediate attention. Contact your healthcare provider or seek emergency care if severe. Bring these questions to your appointment."
    elif risk_level == "high":
        guidance = "You have high-priority findings. Schedule an appointment and bring these questions to guide discussion."
    elif risk_level == "moderate":
        guidance = "Some abnormal values warrant discussion. These questions can help you have a productive conversation."
    else:
        guidance = "Your results are generally within normal ranges. These questions can still help with preventive care."

    for k in prompts:
        seen = set()
        prompts[k] = [x for x in prompts[k] if x not in seen and not seen.add(x)]
    total = sum(len(v) for v in prompts.values())
    return {"prompts": prompts, "summary": {"total_questions": total}, "guidance": guidance}
