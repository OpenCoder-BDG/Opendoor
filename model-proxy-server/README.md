# Model Proxy Server

A comprehensive model management system for Google Cloud Platform with TPU support, featuring a web frontend for HuggingFace model selection and OpenAI-compatible API endpoints.

## Features

- **TPU Support**: Optimized for Google Cloud TPU v2-8 with JAX/Flax backend
- **HuggingFace Integration**: Search and deploy models directly from HuggingFace Hub
- **OpenAI-Compatible API**: Standard chat completions endpoint for easy integration
- **Web Frontend**: User-friendly interface for model selection and management
- **Individual User Endpoints**: Each deployed model gets unique API endpoints and keys
- **Model Compatibility Filtering**: Automatically filters out incompatible model formats (MLX, GGUF, ONNX)
- **Dynamic Model Loading**: Download and deploy models on-demand
- **Persistent Storage**: 100GB storage with proper volume mounting

## Architecture

### Backend Components

1. **model_proxy_server.py** - Main server with full functionality
2. **enhanced_model_server.py** - Enhanced version with additional features
3. **model_server.py** - Original base server implementation
4. **improved_server_with_confirmation.py** - Server with UI confirmation dialogs

### Frontend Components

1. **frontend.html** - Complete web interface with model search and deployment
2. **start_enhanced_server.sh** - Enhanced startup script
3. **start_server.sh** - Basic startup script

### Utility Scripts

1. **debug_devstral.py** - Debug script for troubleshooting specific models
2. **add_compatibility_filter.py** - Script to add model compatibility filtering
3. **fixed_model_loader.py** - Fixed model loading for different model types

## Infrastructure Setup

### Google Cloud Platform Requirements

- **Project**: capable-acrobat-460705-t1
- **TPU VM**: vllm-model-server (v2-8 accelerator)
- **Storage**: 100GB persistent disk mounted at /mnt/models
- **Network**: Default VPC with firewall rules for ports 8000, 8001
- **Location**: us-central1-b

### Dependencies

```bash
# Core ML Libraries
jax==0.6.1
jaxlib==0.6.1
flax==0.10.6
transformers==4.52.4
torch==2.7.0+cpu
torch_xla==2.7.0

# API and Web Framework
fastapi==0.115.12
uvicorn
requests
pydantic

# HuggingFace Integration
huggingface_hub==0.32.3
datasets==3.6.0
accelerate==1.7.0
sentencepiece

# Utilities
numpy
pandas
```

## Installation

### 1. TPU VM Setup

```bash
# Create TPU VM
gcloud compute tpus tpu-vm create vllm-model-server \
  --zone=us-central1-b \
  --accelerator-type=v2-8 \
  --version=tpu-ubuntu2204-base

# Create storage disk
gcloud compute disks create vllm-storage-disk \
  --size=100GB \
  --zone=us-central1-b \
  --type=pd-standard

# Attach disk to TPU VM
gcloud compute tpus tpu-vm attach-disk vllm-model-server \
  --zone=us-central1-b \
  --disk=vllm-storage-disk
```

### 2. Environment Setup

```bash
# SSH into TPU VM
gcloud compute tpus tpu-vm ssh vllm-model-server --zone=us-central1-b

# Mount storage
sudo mkdir -p /mnt/models
sudo mount /dev/sdb /mnt/models
sudo chown -R $USER:$USER /mnt/models

# Create virtual environment
python3 -m venv ~/vllm-server/venv
source ~/vllm-server/venv/bin/activate

# Install dependencies
pip install -U pip
pip install jax[tpu] -f https://storage.googleapis.com/jax-releases/libtpu_releases.html
pip install flax transformers torch torch_xla fastapi uvicorn huggingface_hub
```

### 3. Deploy Application

```bash
# Copy files to TPU VM
scp -r model-proxy-server/* user@tpu-vm-ip:~/vllm-server/

# Start server
cd ~/vllm-server
chmod +x start_enhanced_server.sh
./start_enhanced_server.sh
```

## Usage

### Web Interface

1. Navigate to `http://[TPU-VM-IP]:8000`
2. Search for HuggingFace models using the search bar
3. Click on a model to select it
4. Choose deployment options (API key optional)
5. Click "Deploy Model" to start deployment
6. Get API endpoint and key for external use

### API Endpoints

#### Search Models
```bash
POST /search-models
{
  "query": "microsoft/DialoGPT",
  "limit": 10
}
```

#### Deploy Model
```bash
POST /deploy-model
{
  "model_id": "microsoft/DialoGPT-small",
  "use_api_key": true
}
```

#### Chat Completions (OpenAI Compatible)
```bash
POST /users/{user_id}/v1/chat/completions
{
  "model": "microsoft/DialoGPT-small",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ]
}
```

#### List Models
```bash
GET /users/{user_id}/v1/models
```

### Integration with OpenHands

The server provides OpenAI-compatible endpoints that can be used with OpenHands:

- **Base URL**: `http://[TPU-VM-IP]:8000/users/{user_id}/v1`
- **API Key**: Generated during model deployment
- **Model Name**: HuggingFace model ID (e.g., "microsoft/DialoGPT-small")

## Model Compatibility

The system automatically filters out incompatible model formats:

- ❌ **MLX models** (Apple Silicon optimized)
- ❌ **GGUF models** (llama.cpp format)
- ❌ **ONNX models** (ONNX runtime format)
- ✅ **Standard PyTorch/Transformers models**
- ✅ **JAX/Flax compatible models**

## File Structure

```
model-proxy-server/
├── model_proxy_server.py              # Main server implementation
├── improved_server_with_confirmation.py # Server with UI confirmations
├── enhanced_model_server.py           # Enhanced server features
├── model_server.py                    # Base server implementation
├── frontend.html                      # Web interface
├── start_enhanced_server.sh           # Enhanced startup script
├── start_server.sh                    # Basic startup script
├── debug_devstral.py                  # Debug utilities
├── add_compatibility_filter.py        # Compatibility filtering
├── fixed_model_loader.py              # Model loading fixes
├── model_proxy_server_backup4.py      # Latest backup
├── requirements.txt                   # Python dependencies
└── README.md                          # This file
```

## Troubleshooting

### Common Issues

1. **TPU Not Detected**: Ensure libtpu is properly installed and TPU is available
2. **Model Loading Errors**: Check model compatibility and storage space
3. **API Connection Issues**: Verify firewall rules and network configuration
4. **Memory Issues**: Monitor TPU memory usage and model size

### Debug Commands

```bash
# Check TPU status
python3 -c "import jax; print(jax.devices())"

# Monitor server logs
tail -f proxy_server_final.log

# Test API endpoints
curl -X GET http://localhost:8000/health
```

## Development

### Adding New Features

1. Modify the appropriate server file (model_proxy_server.py for main features)
2. Update the frontend.html for UI changes
3. Test thoroughly with different model types
4. Update documentation

### Model Support

To add support for new model architectures:

1. Update the `is_model_compatible()` function
2. Modify the `load_model_async()` function for new model types
3. Update the chat completion logic if needed

## License

This project is part of the OpenHands ecosystem and follows the same licensing terms.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review server logs for error details
3. Verify TPU and storage configuration
4. Test with known working models first