from langchain_core.prompts import ChatPromptTemplate

chat_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant. {context}"),
    ("human", "{input}"),
])

# Classification prompt template (used to build the classifier prompt)
classification_template = (
    "Classify the home-services job request into exactly one of the provided "
    "categories when possible. Suggest up to five skills from the provided skills list.\n\n"
    "Language: {language}\n"
    "Job title: {title}\n"
    "Job description: {description}\n\n"
    "{taxonomy_prompt}\n"
    "Return JSON only with this exact shape:\n"
    '{{"category_slug": "string or null", "skill_slugs": ["skill-slug"], "confidence": 0.0, "reasoning_summary": "short explanation"}}'  # noqa: E501
)
