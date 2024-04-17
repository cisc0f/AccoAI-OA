import os
from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin
from openai import OpenAI, RateLimitError
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

# Initialize the OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Initialize the Flask application
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# History of the chats (tmp is a dictionary) this would be a DB in a real application
# Example:
# {
#   "chat_id" : { 
#     chat_id: "123",
#     content: [
#         {role: "user", content: "Hello"}, 
#         {role: "assistant", content: "Hi"}
#     ], 
#     timestamp: 12123213, 
#     title: "A chat about nothing" 
#   } 
# }
history = {}

# Get the health status of the API
@app.route("/api/health", methods=['GET'])
def get_health():
    """Return the health status of the API."""
    return jsonify({'status': 'OK'}), 200

# Get the histories
@app.route("/api/history", methods=['GET'])
def get_history():
    """Return the history of the chat."""
    return jsonify(history), 200

# Delete a single chat from the history
@app.route("/api/history/<chat_id>", methods=['DELETE'])
def delete_chat(chat_id):
    """Delete a chat from the history."""
    if chat_id in history:
        del history[chat_id]
        return jsonify({'message': 'Chat deleted successfully'}), 200
    else:
        return jsonify({'message': 'Chat not found'}), 404

# Invoke OpenAI endpoint and stream response
@app.route("/api/chat", methods=['POST'])
def chat():
    """Return in streaming the answer"""
    prompt = request.json['prompt']
    chat_id = request.json['chat_id']

    # Initialize new history and system context if not exists
    if chat_id not in history:
        history[chat_id] = {
            "chat_id": chat_id,
            "timestamp": datetime.now().timestamp(), 
            "title": prompt,
            "content": [],
        }

    # Append user message
    history[chat_id]["content"].append({"role": "user", "content": prompt})

    def stream():
        try:
            completion = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages= [{"role": "system", "content": "You are a helpful assistant."}] + history[chat_id]["content"],
                stream=True
            )

            complete_output = ""
            for chunk in completion:
                content = chunk.choices[0].delta.content
                if content:
                    complete_output += content
                    yield content

            # Append final assistant message to history
            history[chat_id]["content"].append({"role": "assistant", "content": complete_output})
        except RateLimitError:
            yield "Rate limit reached. Please try again later."

    return stream(), {'Content-Type': 'text/plain'}


if __name__ == '__main__':
    app.run(debug=True, port=5000)