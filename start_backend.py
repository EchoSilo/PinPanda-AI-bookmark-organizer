#!/usr/bin/env python3
"""
Script to start the PinPanda FastAPI backend server
"""
import subprocess
import sys
import os

def check_requirements():
    """Check if required packages are installed"""
    try:
        import fastapi
        import uvicorn
        import httpx
        import pydantic
        print("✓ All required packages are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing required package: {e}")
        print("Installing requirements...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
            print("✓ Requirements installed successfully")
            return True
        except subprocess.CalledProcessError:
            print("✗ Failed to install requirements")
            return False

def start_server():
    """Start the FastAPI server"""
    print("Starting PinPanda AI Backend Server...")
    print("Server will be available at: http://localhost:8000")
    print("API documentation: http://localhost:8000/docs")
    print("Press Ctrl+C to stop the server")
    
    try:
        os.chdir("backend")
        subprocess.run([sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"])
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Error starting server: {e}")

if __name__ == "__main__":
    if check_requirements():
        start_server()
    else:
        print("Please install the required packages and try again.")
        sys.exit(1)