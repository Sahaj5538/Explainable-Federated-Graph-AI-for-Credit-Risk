Credit Risk Project — Architecture

1. Architecture Overview

The project follows a modular architecture separating data, graph processing, machine learning, federated learning, explainability, evaluation, backend services, and frontend presentation.

credit-risk-project/
│
├── backend/
│   ├── api/
│   ├── database/
│   ├── data/
│   │   ├── generator/
│   │   ├── preprocessing/
│   │   └── datasets/
│   │
│   ├── graph/
│   │   ├── construction/
│   │   ├── features/
│   │   └── temporal/
│   │
│   ├── models/
│   │   ├── baselines/
│   │   ├── gnn/
│   │   ├── temporal/
│   │   └── heterogeneous/
│   │
│   ├── explainability/
│   │   ├── shap/
│   │   ├── gnn_explainer/
│   │   └── explanations/
│   │
│   ├── federated/
│   │   ├── clients/
│   │   ├── server/
│   │   ├── aggregation/
│   │   └── privacy/
│   │
│   ├── evaluation/
│   │   ├── metrics/
│   │   ├── calibration/
│   │   └── experiments/
│   │
│   └── services/
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── charts/
│       └── services/
│
├── tests/
├── notebooks/
├── configs/
├── docs/
├── scripts/
├── docker-compose.yml
├── README.md
└── requirements.txt

2. Root Architecture

credit-risk-project/

The root directory is the top-level container for the entire system.

It separates the project into major layers:

Backend        → Core application and ML system
Frontend       → User interface and visualization
Tests          → Automated testing
Notebooks      → Research and experimentation
Configs        → Configuration
Docs           → Project documentation
Scripts        → Automation and utility scripts
Docker         → Environment/service orchestration
Requirements   → Python dependencies

The root should contain project-level configuration and documentation, rather than implementation code.

3. Backend Architecture

backend/

The backend is the main computational layer of the project.

It contains:

API
Database
Data Pipeline
Graph Pipeline
ML Models
Explainability
Federated Learning
Evaluation
Services

The backend architecture can be viewed as:

                 ┌──────────────────┐
                 │      API         │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │    Services      │
                 └────────┬─────────┘
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
       ▼                  ▼                  ▼
    Models          Explainability      Federated
       │                  │              Learning
       │                  │                  │
       └──────────────┬───┴──────────────────┘
                      │
                      ▼
                   Graph
                      │
                      ▼
                    Data

4. API

backend/api/

The API layer is the external interface of the backend.

It allows the frontend or other clients to communicate with the credit-risk system.

Typical responsibilities include:

Receiving prediction requests

Returning credit-risk scores

Returning account information

Returning transaction information

Returning graph information

Returning explanations

Returning model/evaluation information

Providing federated-learning status

Conceptually:

Frontend
   │
   │ HTTP / REST
   ▼
API
   │
   ▼
Backend Services

The API should act as an entry point rather than containing the core ML implementation itself.

5. Database

backend/database/

The database layer handles persistent application data.

It is responsible for:

Database connection

Data models

Database queries

CRUD operations

Persistence of application-level information

Conceptually:

Backend Services
       │
       ▼
   Database Layer
       │
       ▼
    Database

The database layer is separate from the ML dataset pipeline so that application persistence and ML experimentation remain independent.

6. Data Architecture

backend/data/

The data module is responsible for creating and preparing the data used by the project.

data/
├── generator/
├── preprocessing/
└── datasets/

The architecture is:

Generator
    ↓
Raw Dataset
    ↓
Preprocessing
    ↓
Processed Dataset
    ↓
Graph / Models

7. Data Generator

backend/data/generator/

The generator creates the synthetic financial data used by the project.

It should generate the entities and relationships required by the credit-risk system.

For example:

Accounts
Transactions
Merchants
Devices
Locations
Risk-related information

The generator is kept separate so that the dataset can be recreated whenever required.

Architecture:

Generation Rules
      ↓
Synthetic Entities
      ↓
Synthetic Relationships
      ↓
Raw Dataset

8. Data Preprocessing

backend/data/preprocessing/

This layer converts raw data into a clean and ML-ready representation.

Typical responsibilities:

Raw Data
   ↓
Validation
   ↓
Cleaning
   ↓
Missing-value handling
   ↓
Encoding
   ↓
Normalization / Scaling
   ↓
Processed Data

Preprocessing belongs before graph construction and model training.

9. Datasets

backend/data/datasets/

This directory contains the generated and processed datasets used by the project.

A possible organization is:

datasets/
├── raw/
├── processed/
├── train/
├── validation/
└── test/

The purpose is to keep different stages of the data pipeline clearly separated.

raw
 ↓
processed
 ↓
train / validation / test

10. Graph Architecture

backend/graph/

The graph layer transforms financial data into graph representations.

graph/
├── construction/
├── features/
└── temporal/

The graph architecture contains three major responsibilities:

Graph Construction
        ↓
Graph Features
        ↓
Temporal Graph Representation

This is a central part of the project because credit risk can depend not only on an individual account but also on relationships between accounts, transactions, merchants, devices, and other entities.

11. Graph Construction

backend/graph/construction/

This module creates the actual graph structure.

It defines:

Nodes

Edges

Node attributes

Edge attributes

Relationships between entities

Example:

Account ───── Transaction ───── Merchant
   │               │
   │               │
 Device ───────────┘
   │
   └──────────── Account

The construction layer converts structured financial records into graph data that can be consumed by graph models.

12. Graph Features

backend/graph/features/

This module creates features derived from graph structure and relationships.

Examples include:

Number of connected entities
Transaction frequency
Merchant diversity
Number of connected devices
Transaction velocity
Neighborhood statistics
Relationship-based features

Architecture:

Graph
 ↓
Graph Structure
 ↓
Graph-derived Features
 ↓
ML Models

This allows the models to use relationship information in addition to normal account-level features.

13. Temporal Graph

backend/graph/temporal/

The temporal layer handles the time dimension of financial activity.

Transactions occur at different timestamps, so the graph can change over time.

Conceptually:

Time T1
Account → Merchant

Time T2
Account → Merchant
        → Device

Time T3
Account → Merchant
        → Device
        → Account

This layer prepares temporal information for temporal models.

It can handle:

Transaction timestamps

Event ordering

Time windows

Dynamic relationships

Historical activity

14. Models Architecture

backend/models/

The models directory contains all machine-learning approaches used in the project.

models/
├── baselines/
├── gnn/
├── temporal/
└── heterogeneous/

The purpose of separating these models is to allow meaningful comparison between different approaches.

                  Models
                     │
       ┌─────────────┼─────────────┐
       │             │             │
       ▼             ▼             ▼
   Baselines        GNN        Temporal
                     │
                     ▼
               Heterogeneous

15. Baseline Models

backend/models/baselines/

Baseline models provide traditional ML benchmarks.

They establish a reference point against which graph-based approaches can be evaluated.

Examples:

Logistic Regression
Random Forest
XGBoost / Gradient Boosting
Other traditional classifiers

Architecture:

Processed Tabular Data
        ↓
Baseline Model
        ↓
Risk Prediction

The baseline layer is important because the project should demonstrate whether graph-based approaches actually provide an improvement.

16. GNN Models

backend/models/gnn/

This module contains Graph Neural Network models.

GNNs learn from both:

Node Features
+
Graph Structure

Architecture:

Graph
  │
  ├── Node Features
  │
  └── Edges
       │
       ▼
     GNN
       │
       ▼
Risk Representation
       │
       ▼
Risk Prediction

Possible GNN architectures can include:

GCN
GraphSAGE
GAT

depending on the final experimental design.

17. Temporal Models

backend/models/temporal/

This module contains models that consider how financial behavior changes over time.

Architecture:

Historical Transactions
        ↓
Temporal Representation
        ↓
Temporal Model
        ↓
Risk Prediction

Temporal models can use:

Transaction sequences

Time windows

Historical account behavior

Changing graph relationships

The temporal layer should remain separate from standard static GNN implementations.

18. Heterogeneous Models

backend/models/heterogeneous/

This module contains models designed for heterogeneous graphs.

A heterogeneous graph contains multiple node and/or edge types.

Example:

Account
   │
   ├── Transaction
   │       │
   │       └── Merchant
   │
   ├── Device
   │
   └── Location

Instead of treating everything as the same node type, the model can learn different semantics for different entity types and relationships.

Architecture:

Heterogeneous Graph
        ↓
Type-aware Representation
        ↓
Heterogeneous GNN
        ↓
Risk Prediction

19. Explainability Architecture

backend/explainability/

The explainability module explains why a model produced a particular risk prediction.

explainability/
├── shap/
├── gnn_explainer/
└── explanations/

Architecture:

Model Prediction
       │
       ▼
Explainability Method
       │
       ├── Feature Importance
       ├── Graph Importance
       └── Relationship Importance
       │
       ▼
Human-readable Explanation

20. SHAP

backend/explainability/shap/

SHAP-based explanations are primarily useful for feature-level explanations.

They can answer questions such as:

Which account features contributed to the risk score?

Which features increased risk?

Which features decreased risk?

Conceptually:

Input Features
      ↓
Model
      ↓
SHAP
      ↓
Feature Contributions

21. GNN Explainer

backend/explainability/gnn_explainer/

This module handles explanations specifically for graph-based models.

It can identify important:

Nodes

Edges

Subgraphs

Features

Conceptually:

Full Graph
    ↓
GNN Prediction
    ↓
Graph Explanation
    ↓
Important Subgraph

This is particularly useful when explaining why a graph-based credit-risk prediction was made.

22. Explanations

backend/explainability/explanations/

This directory contains the final explanation representation.

The output can be transformed into a format suitable for:

API
Frontend
Reports
Evaluation
Storage

For example:

Risk Score: 0.82

Important factors:
- High transaction velocity
- Unusual merchant activity
- Multiple connected devices
- Recent high-value transactions

The explanation generation layer should separate model-specific explanation logic from the final user-facing explanation format.

23. Federated Learning Architecture

backend/federated/

The federated learning module simulates or implements decentralized model training.

federated/
├── clients/
├── server/
├── aggregation/
└── privacy/

The architecture is:

              Central Server
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
     Client 1    Client 2    Client 3
        │           │           │
     Local Data  Local Data  Local Data
        │           │           │
     Local Model Local Model Local Model
        │           │           │
        └───────────┼───────────┘
                    ▼
               Aggregation
                    │
                    ▼
             Global Model

The key idea is that raw client data does not need to be centralized for model training.

24. Federated Clients

backend/federated/clients/

Clients represent separate institutions or data silos.

For example:

Client 1 → Bank A
Client 2 → Bank B
Client 3 → Bank C

Each client:

Receives Global Model
        ↓
Trains on Local Data
        ↓
Produces Model Update
        ↓
Sends Update to Server

25. Federated Server

backend/federated/server/

The server coordinates federated training.

Responsibilities include:

Sending the global model

Managing training rounds

Receiving client updates

Triggering aggregation

Updating the global model

Architecture:

Global Model
    ↓
Clients
    ↓
Client Updates
    ↓
Server
    ↓
Aggregation
    ↓
Updated Global Model

26. Aggregation

backend/federated/aggregation/

This module combines client model updates into a global model.

A common approach is:

Client Models
     ↓
Aggregation Algorithm
     ↓
Global Model

The aggregation implementation should remain separate from client and server orchestration so different aggregation strategies can be experimented with.

27. Privacy

backend/federated/privacy/

This module contains privacy-related mechanisms for federated learning.

Depending on the final project scope, it can contain mechanisms such as:

Secure aggregation
Update protection
Noise mechanisms
Privacy accounting
Data isolation controls

The purpose is to separate privacy mechanisms from the basic federated-learning workflow.

28. Evaluation Architecture

backend/evaluation/

The evaluation module measures how well the models perform.

evaluation/
├── metrics/
├── calibration/
└── experiments/

Architecture:

Model
  ↓
Predictions
  ↓
Evaluation
  ├── Metrics
  ├── Calibration
  └── Experiments

29. Metrics

backend/evaluation/metrics/

This module contains evaluation metrics.

For credit-risk classification, metrics may include:

Accuracy
Precision
Recall
F1-score
ROC-AUC
PR-AUC
Confusion Matrix

The exact metrics should be selected based on the final prediction task and class imbalance.

30. Calibration

backend/evaluation/calibration/

Calibration evaluates whether predicted probabilities correspond reasonably to actual outcome frequencies.

Example:

Predicted probability = 0.80

Ideally, cases receiving approximately 0.80
probability should experience the target event
at roughly that frequency.

This is particularly relevant to credit-risk systems because a probability score should be meaningful, not merely useful for ranking.

Possible calibration methods and analyses can include:

Calibration curves
Brier score
Expected calibration error
Probability calibration

31. Experiments

backend/evaluation/experiments/

This directory organizes controlled experiments.

Examples:

Baseline vs GNN
GNN vs Temporal GNN
Homogeneous vs Heterogeneous Graph
Centralized vs Federated Training
With vs Without Graph Features
With vs Without Explainability-related analysis

A typical experiment:

Dataset
   ↓
Model Configuration
   ↓
Training
   ↓
Prediction
   ↓
Metrics
   ↓
Comparison

This keeps research experiments reproducible and organized.

32. Services

backend/services/

The services layer coordinates application-level operations.

It acts as a bridge between the API and the underlying modules.

For example:

API
 ↓
Risk Prediction Service
 ↓
Model
 ↓
Prediction

Other possible services:

Account Service
Prediction Service
Graph Service
Explanation Service
Federated Learning Service
Evaluation Service

The goal is to prevent API routes from becoming tightly coupled to individual ML implementations.

33. Frontend Architecture

frontend/
└── src/
    ├── components/
    ├── pages/
    ├── charts/
    └── services/

The frontend is the presentation layer.

Its responsibility is to display the results produced by the backend.

Architecture:

Backend API
     │
     ▼
Frontend Services
     │
     ├───────────────┐
     ▼               ▼
Pages          Components
     │               │
     └───────┬───────┘
             ▼
           Charts

34. Frontend Components

frontend/src/components/

Reusable UI elements belong here.

Examples:

RiskScoreCard
AccountCard
TransactionTable
RiskIndicator
ExplanationPanel
GraphViewer
ModelComparison

Components should be reusable across multiple pages.

35. Frontend Pages

frontend/src/pages/

Pages represent complete screens of the application.

Possible pages:

Dashboard
Account Details
Risk Analysis
Transaction Analysis
Graph Analysis
Model Comparison
Federated Learning
Explainability

A page combines multiple reusable components.

36. Frontend Charts

frontend/src/charts/

This directory contains visualization-specific components.

Possible visualizations:

Risk score charts
Transaction trends
Feature importance
Calibration curves
ROC curves
Model comparison
Graph visualization
Federated training progress

Charts should focus on visualization rather than backend data retrieval.

37. Frontend Services

frontend/src/services/

This layer handles communication between the frontend and backend.

Architecture:

Frontend Page
     ↓
Frontend Service
     ↓
API
     ↓
Backend

Possible services:

api.js
riskService.js
accountService.js
graphService.js
explanationService.js
federatedService.js

38. Tests

tests/

The test directory contains automated tests for the system.

Tests can be organized by architecture layer:

tests/
├── data/
├── graph/
├── models/
├── explainability/
├── federated/
├── evaluation/
├── api/
└── services/

The goal is to verify that individual components and complete workflows behave correctly.

39. Notebooks

notebooks/

Notebooks are intended for research, exploration, visualization, and experimentation.

Examples:

01_data_exploration.ipynb
02_graph_analysis.ipynb
03_baseline_experiments.ipynb
04_gnn_experiments.ipynb
05_temporal_experiments.ipynb
06_federated_experiments.ipynb
07_explainability_analysis.ipynb

Notebooks should primarily be used for experimentation and analysis.

Production logic should remain inside backend/.

40. Configs

configs/

Configuration files belong here.

They allow experiments and environments to be changed without modifying source code.

Possible configuration categories:

Dataset configuration
Model configuration
Training configuration
Federated configuration
Database configuration
API configuration
Experiment configuration

Example:

configs/
├── data.yaml
├── model.yaml
├── training.yaml
├── federated.yaml
└── experiment.yaml

41. Docs

docs/

The documentation directory contains project documentation.

Possible documents:

architecture.md
data.md
graph.md
models.md
federated-learning.md
explainability.md
experiments.md
api.md

The README.md should provide the high-level project introduction, while docs/ contains deeper technical documentation.

42. Scripts

scripts/

Scripts automate repetitive project operations.

Possible scripts:

generate_data.py
preprocess_data.py
build_graph.py
train_model.py
evaluate_model.py
run_experiment.py

Example workflow:

scripts/generate_data.py
        ↓
scripts/preprocess_data.py
        ↓
scripts/build_graph.py
        ↓
scripts/train_model.py
        ↓
scripts/evaluate_model.py

Scripts should orchestrate existing backend functionality rather than duplicating core implementation.

43. Docker Compose

docker-compose.yml

This file defines how multiple project services can run together.

For example:

Frontend
Backend API
Database

Conceptually:

┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Backend API │
└──────┬──────┘
       │
 ┌─────┴──────┐
 ▼            ▼
Database     ML Services

Docker Compose provides a reproducible development/runtime environment.

44. README

README.md

The root README is the entry point for anyone viewing the repository.

It should explain:

Project purpose
Architecture overview
Main technologies
How to install
How to generate data
How to train models
How to run the backend
How to run the frontend
How to run tests
How to reproduce experiments

Detailed technical explanations should be placed in docs/.

45. Requirements

requirements.txt

This file contains the Python dependencies required by the backend and ML components.

Typical dependency categories include:

Data processing
Machine learning
Deep learning
Graph learning
Federated learning
Explainability
API
Database
Testing

The exact libraries should be selected according to the implementation rather than adding unnecessary dependencies.

46. Complete Architecture Flow

The complete system can be understood as the following sequence:

                    ┌───────────────────┐
                    │ Synthetic Dataset │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Preprocessing   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Graph Construction│
                    └─────────┬─────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
       ┌─────────────────┐        ┌─────────────────┐
       │ Graph Features  │        │ Temporal Graph  │
       └────────┬────────┘        └────────┬────────┘
                │                          │
                └────────────┬─────────────┘
                             ▼
                     ┌───────────────┐
                     │    Models     │
                     └───────┬───────┘
                             │
             ┌───────────────┼────────────────┐
             │               │                │
             ▼               ▼                ▼
        Baselines           GNN          Temporal /
                                           Heterogeneous
             │               │                │
             └───────────────┼────────────────┘
                             ▼
                    ┌─────────────────┐
                    │ Federated       │
                    │ Learning        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Risk Prediction │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
     ┌──────────────────┐         ┌──────────────────┐
     │ Explainability   │         │    Evaluation    │
     │ SHAP / GNN       │         │ Metrics /        │
     │ Explainer        │         │ Calibration      │
     └────────┬─────────┘         └────────┬─────────┘
              │                            │
              └──────────────┬─────────────┘
                             ▼
                       ┌───────────┐
                       │ API /     │
                       │ Services  │
                       └─────┬─────┘
                             │
                             ▼
                       ┌───────────┐
                       │ Frontend  │
                       └───────────┘

47. Architectural Separation of Responsibilities

The most important architectural principle is that each layer should have one primary responsibility.

Layer

Responsibility

data/generator

Create synthetic data

data/preprocessing

Clean and prepare data

data/datasets

Store dataset stages

graph/construction

Build graph structures

graph/features

Generate graph-derived features

graph/temporal

Handle temporal graph information

models/baselines

Traditional ML benchmarks

models/gnn

Standard GNN models

models/temporal

Temporal models

models/heterogeneous

Heterogeneous graph models

explainability/shap

Feature-level explanations

explainability/gnn_explainer

Graph-level explanations

explainability/explanations

Format final explanations

federated/clients

Local client training

federated/server

Federated coordination

federated/aggregation

Combine client updates

federated/privacy

Privacy mechanisms

evaluation/metrics

Model performance metrics

evaluation/calibration

Probability calibration

evaluation/experiments

Controlled experiments

services

Application/business orchestration

api

External backend interface

frontend

User interface

tests

Automated verification

notebooks

Research and exploration

configs

Configuration

docs

Technical documentation

scripts

Automation

docker-compose.yml

Multi-service environment

README.md

Repository entry point

requirements.txt

Python dependencies

48. Dependency Direction

The architecture should generally follow this dependency direction:

Data
 ↓
Graph
 ↓
Models
 ↓
Explainability / Evaluation
 ↓
Services
 ↓
API
 ↓
Frontend

Federated learning interacts primarily with:

Models
Data
Privacy
Aggregation

It should not make the frontend directly responsible for ML implementation.

Similarly:

Frontend
   ↓
API
   ↓
Services
   ↓
ML / Graph / Data

rather than:

Frontend
   ↓
ML implementation

This separation makes the project easier to test, maintain, extend, and reproduce.

49. Core Architectural Principle

The project should remain modular enough that one part can be replaced without rewriting the entire system.

For example:

Random Forest
     ↓
can be replaced by
     ↓
XGBoost

without changing the frontend architecture.

Likewise:

GCN
 ↓
can be replaced by
 ↓
GAT / GraphSAGE

without changing the data generator.

Similarly:

Centralized Training
       ↓
Federated Training

should be an architectural extension rather than a complete rewrite of the model layer.

The overall architecture should therefore support:

Replaceable Models
+
Reusable Data Pipeline
+
Reusable Graph Pipeline
+
Independent Explainability
+
Independent Evaluation
+
Independent Federated Layer
+
API/Frontend Separation

This makes the project suitable for iterative development from V1 to more advanced versions.