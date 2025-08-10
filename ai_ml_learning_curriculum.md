# AI/ML 학습을 위한 종합 커리큘럼

## 파트 1: AI/ML 학습을 위한 기초 (Foundations)

### 1.1. 수학 (Mathematics)

#### 1.1.1. 선형대수 (Linear Algebra)
- 스칼라, 벡터, 행렬, 텐서의 이해
- 행렬 연산 (덧셈, 뺄셈, 곱셈, 전치)
- 내적(Dot Product) 및 외적(Cross Product)
- 단위행렬(Identity Matrix)과 역행렬(Inverse Matrix)
- 행렬식(Determinant)
- 고유값(Eigenvalues)과 고유벡터(Eigenvectors)
- 특이값 분해 (Singular Value Decomposition, SVD)
- 주성분 분석 (Principal Component Analysis, PCA) - 기초 개념

#### 1.1.2. 미적분 (Calculus)
- 극한(Limits)과 연속(Continuity)
- 미분(Derivatives)과 미분계수
- 편미분(Partial Derivatives)
- 연쇄 법칙 (Chain Rule)
- 그래디언트 (Gradient)
- 적분(Integrals)
- 시그모이드(Sigmoid), ReLU 등 활성화 함수의 미분

#### 1.1.3. 확률 및 통계 (Probability & Statistics)
- 기본적인 확률 이론 (사건, 표본 공간, 조건부 확률)
- 베이즈 정리 (Bayes' Theorem)
- 확률 변수 (Random Variables)
- 확률 분포 (균등, 정규, 베르누이, 이항, 포아송 분포)
- 기댓값(Expected Value), 분산(Variance), 표준편차(Standard Deviation)
- 중심극한정리 (Central Limit Theorem)
- 기술 통계 (Descriptive Statistics): 평균, 중앙값, 최빈값
- 추론 통계 (Inferential Statistics): 가설 검정, 신뢰 구간
- 최대 가능도 추정 (Maximum Likelihood Estimation, MLE)

#### 1.1.4. 최적화 (Optimization)
- 비용 함수 (Cost Function) / 손실 함수 (Loss Function)
- 경사 하강법 (Gradient Descent) 및 변형 (Stochastic, Mini-batch)
- 볼록 최적화 (Convex Optimization)
- 라그랑주 승수법 (Lagrange Multipliers)

### 1.2. 컴퓨터 과학 (Computer Science)

#### 1.2.1. 프로그래밍 기초 (Programming Fundamentals with Python)
- 파이썬 기본 문법 (변수, 자료형, 연산자)
- 제어문 (조건문, 반복문)
- 함수와 모듈
- 객체 지향 프로그래밍 (OOP) 기초 (클래스, 객체)
- 파일 입출력
- 필수 라이브러리:
  - **NumPy**: 다차원 배열 및 행렬 연산
  - **Pandas**: 데이터 조작 및 분석 (DataFrame, Series)
  - **Matplotlib/Seaborn**: 데이터 시각화

#### 1.2.2. 자료구조 및 알고리즘 (Data Structures & Algorithms)
- 시간 복잡도와 공간 복잡도 (Big O 표기법)
- 기본 자료구조: 배열, 연결 리스트, 스택, 큐
- 고급 자료구조: 트리, 힙, 해시 테이블, 그래프
- 정렬 알고리즘 (버블, 선택, 삽입, 병합, 퀵 정렬)
- 탐색 알고리즘 (선형, 이진 탐색)
- 그래프 순회 (너비 우선 탐색 - BFS, 깊이 우선 탐색 - DFS)

## 파트 2: 인공지능(AI) 및 머신러닝(ML) 소개 (Introduction to AI & ML)

### 2.1. 인공지능의 역사와 발전 (History and Evolution of AI)
- 튜링 테스트와 AI의 탄생 (앨런 튜링)
- 다트머스 회의: '인공지능' 용어의 등장
- AI의 황금기와 암흑기 (AI Winters)
- 전문가 시스템(Expert Systems)의 시대
- 머신러닝의 부상과 딥러닝 혁명

### 2.2. AI, 머신러닝, 딥러닝의 관계 (Relationship between AI, ML, and Deep Learning)
- 인공지능 (Artificial Intelligence): 기계가 인간의 지능을 모방하도록 하는 포괄적인 개념
- 머신러닝 (Machine Learning): 데이터로부터 패턴을 학습하여 스스로 성능을 향상시키는 AI의 한 분야
- 딥러닝 (Deep Learning): 인공 신경망(Artificial Neural Networks)에 기반한 머신러닝의 한 하위 분야

### 2.3. 머신러닝의 종류 (Types of Machine Learning)

#### 2.3.1. 지도학습 (Supervised Learning)
- 레이블(Label)이 있는 데이터를 사용
- **주요 과제:**
  - **분류 (Classification):** 카테고리를 예측 (예: 스팸 메일 분류, 이미지 분류)
  - **회귀 (Regression):** 연속적인 값을 예측 (예: 주택 가격 예측, 주가 예측)

#### 2.3.2. 비지도학습 (Unsupervised Learning)
- 레이블이 없는 데이터를 사용
- **주요 과제:**
  - **군집화 (Clustering):** 데이터 내의 그룹을 발견 (예: 고객 세분화)
  - **차원 축소 (Dimensionality Reduction):** 데이터의 특성(feature) 수를 줄임
  - **연관 규칙 학습 (Association Rule Learning):** 데이터 항목 간의 관계를 발견 (예: 장바구니 분석)

#### 2.3.3. 강화학습 (Reinforcement Learning)
- 보상(Reward)을 최대화하는 방향으로 에이전트(Agent)가 학습
- **주요 구성요소:** 에이전트(Agent), 환경(Environment), 상태(State), 행동(Action), 보상(Reward)
- **적용 분야:** 게임 AI (알파고), 로보틱스, 자율주행

### 2.4. 머신러닝 프로젝트의 전체 과정 (The Machine Learning Workflow)
1. **문제 정의 (Problem Definition):** 비즈니스 목표 이해 및 ML 문제로 변환
2. **데이터 수집 (Data Collection):** 필요한 데이터 확보
3. **데이터 탐색 및 전처리 (Data Exploration and Preprocessing):**
   - 탐색적 데이터 분석 (EDA)
   - 결측치 및 이상치 처리
   - 데이터 정규화 / 표준화
   - 특성 공학 (Feature Engineering)
4. **모델 선택 (Model Selection):** 문제에 적합한 알고리즘 선택
5. **모델 훈련 (Model Training):** 훈련 데이터셋으로 모델 학습
6. **모델 평가 (Model Evaluation):** 테스트 데이터셋으로 모델 성능 검증
7. **하이퍼파라미터 튜닝 (Hyperparameter Tuning):** 모델 성능 최적화
8. **모델 배포 및 모니터링 (Deployment and Monitoring):** 실제 환경에 모델을 적용하고 성능을 지속적으로 관리

## 파트 3: 핵심 머신러닝 (Core Machine Learning)

### 3.1. 지도 학습 (Supervised Learning)

#### 3.1.1. 회귀 (Regression)
- **선형 회귀 (Linear Regression):** 기본 개념, 비용 함수, 경사 하강법 적용
- **다항 회귀 (Polynomial Regression):** 비선형 관계 모델링
- **규제가 있는 회귀 (Regularized Regression):**
  - **릿지 회귀 (Ridge Regression):** L2 규제
  - **라쏘 회귀 (Lasso Regression):** L1 규제
  - **엘라스틱넷 (ElasticNet):** L1과 L2 규제의 결합

#### 3.1.2. 분류 (Classification)
- **로지스틱 회귀 (Logistic Regression):** 시그모이드 함수, 이진 분류
- **k-최근접 이웃 (k-Nearest Neighbors, k-NN):** 거리 기반 모델, 인스턴스 기반 학습
- **서포트 벡터 머신 (Support Vector Machines, SVM):** 마진 최대화, 커널 트릭
- **결정 트리 (Decision Trees):** 정보 이득, 지니 불순도, 가지치기
- **나이브 베이즈 분류기 (Naive Bayes Classifier):** 베이즈 정리 기반, 특성 독립 가정

#### 3.1.3. 앙상블 학습 (Ensemble Learning)
- **보팅 (Voting) 및 배깅 (Bagging):**
  - **보팅:** 여러 모델의 예측을 투표로 결합
  - **배깅:** 데이터 샘플링을 통해 여러 모델을 학습 (예: 부트스트랩)
- **랜덤 포레스트 (Random Forest):** 결정 트리의 앙상블 (배깅 + 특성 무작위 선택)
- **부스팅 (Boosting):**
  - **AdaBoost:** 오답에 가중치를 부여하며 순차적으로 학습
  - **그래디언트 부스팅 머신 (Gradient Boosting Machine, GBM):** 잔여 오차를 학습
  - **XGBoost, LightGBM, CatBoost:** GBM의 성능 및 속도 개선 모델

### 3.2. 비지도 학습 (Unsupervised Learning)

#### 3.2.1. 군집화 (Clustering)
- **K-평균 군집화 (K-Means Clustering):** 중심점(Centroid) 기반 군집화
- **계층적 군집화 (Hierarchical Clustering):** 덴드로그램, 병합/분할 방식
- **DBSCAN (Density-Based Spatial Clustering of Applications with Noise):** 밀도 기반 군집화

#### 3.2.2. 차원 축소 (Dimensionality Reduction)
- **주성분 분석 (Principal Component Analysis, PCA):** 분산을 최대로 보존하는 축을 찾아 차원 축소
- **t-SNE (t-Distributed Stochastic Neighbor Embedding):** 고차원 데이터의 시각화에 주로 사용

### 3.3. 모델 평가 및 성능 향상 (Model Evaluation & Enhancement)

#### 3.3.1. 핵심 개념 (Key Concepts)
- **과대적합 (Overfitting) 과 과소적합 (Underfitting):** 모델의 일반화 능력
- **편향-분산 트레이드오프 (Bias-Variance Tradeoff):** 모델 복잡도와의 관계
- **교차 검증 (Cross-Validation):** K-Fold, Stratified K-Fold

#### 3.3.2. 회귀 모델 평가 지표 (Regression Metrics)
- **MAE (Mean Absolute Error):** 평균 절대 오차
- **MSE (Mean Squared Error):** 평균 제곱 오차
- **RMSE (Root Mean Squared Error):** 평균 제곱근 오차
- **R² (R-squared):** 결정 계수 (모델의 설명력)

#### 3.3.3. 분류 모델 평가 지표 (Classification Metrics)
- **혼동 행렬 (Confusion Matrix):** TP, FP, FN, TN
- **정확도 (Accuracy):** 전체 예측 중 올바른 예측의 비율
- **정밀도 (Precision):** Positive로 예측한 것 중 실제 Positive의 비율
- **재현율 (Recall) / 민감도 (Sensitivity):** 실제 Positive 중 Positive로 예측한 비율
- **F1 점수 (F1-Score):** 정밀도와 재현율의 조화 평균
- **ROC 곡선과 AUC (Area Under the Curve):** 분류 모델의 성능을 종합적으로 평가

## 파트 4: 딥러닝 (Deep Learning)

### 4.1. 인공 신경망 기초 (Neural Network Basics)
- **퍼셉트론 (Perceptron)과 다층 퍼셉트론 (Multi-Layer Perceptron, MLP):** 신경망의 기본 단위
- **활성화 함수 (Activation Functions):**
  - Sigmoid, Tanh, ReLU, Leaky ReLU, PReLU, ELU, Softmax
- **손실 함수 (Loss Functions):**
  - 회귀: MSE, MAE
  - 분류: Binary Cross-Entropy, Categorical Cross-Entropy
- **역전파 알고리즘 (Backpropagation):** 그래디언트 계산 및 가중치 업데이트 원리
- **옵티마이저 (Optimizers):**
  - 경사 하강법의 종류: SGD, Momentum, Nesterov Momentum
  - 적응적 학습률 옵티마이저: Adagrad, RMSprop, Adam

### 4.2. 딥러닝 모델 학습 기술 (Techniques for Training Deep Neural Networks)
- **가중치 초기화 (Weight Initialization):** Xavier/Glorot, He 초기화
- **배치 정규화 (Batch Normalization):** 내부 공변량 변화 문제 해결
- **드롭아웃 (Dropout):** 과대적합 방지를 위한 규제 기법
- **학습률 스케줄링 (Learning Rate Scheduling):** Step Decay, Cosine Annealing 등

### 4.3. 합성곱 신경망 (Convolutional Neural Networks, CNN)
- **CNN의 핵심 구성요소:**
  - **합성곱 (Convolution) 레이어:** 필터(Filter)/커널(Kernel), 스트라이드(Stride), 패딩(Padding)
  - **풀링 (Pooling) 레이어:** Max Pooling, Average Pooling
- **주요 CNN 아키텍처:**
  - **LeNet-5, AlexNet, VGGNet, GoogLeNet (Inception), ResNet (Residual Networks), DenseNet**
- **응용 분야:**
  - **이미지 분류 (Image Classification)**
  - **객체 탐지 (Object Detection):** R-CNN, Fast R-CNN, Faster R-CNN, YOLO, SSD
  - **이미지 분할 (Image Segmentation):** FCN, U-Net

### 4.4. 순환 신경망 (Recurrent Neural Networks, RNN)
- **순차 데이터 (Sequential Data)의 이해:** 시계열, 텍스트 데이터
- **RNN의 기본 구조와 한계:** 기울기 소실/폭주 문제 (Vanishing/Exploding Gradient Problem)
- **LSTM (Long Short-Term Memory):** Cell State, Forget/Input/Output Gate를 통한 장기 의존성 학습
- **GRU (Gated Recurrent Unit):** LSTM을 단순화한 모델
- **양방향 RNN (Bidirectional RNN):** 과거와 미래 정보를 모두 활용
- **응용 분야:** 자연어 처리(NLP), 시계열 예측

### 4.5. 트랜스포머와 어텐션 메커니즘 (Transformers and Attention Mechanism)
- **어텐션 메커니즘 (Attention Mechanism):** Seq2Seq 모델의 한계 극복
- **트랜스포머 (Transformer) 아키텍처:**
  - **Self-Attention, Multi-Head Attention**
  - **Positional Encoding**
  - **인코더-디코더 구조**
- **주요 트랜스포머 기반 모델:**
  - **BERT (Bidirectional Encoder Representations from Transformers)**
  - **GPT (Generative Pre-trained Transformer)**
  - **T5, BART**
- **응용 분야:** 기계 번역, 텍스트 생성, 요약, 질의응답

### 4.6. 생성 모델 (Generative Models)
- **오토인코더 (Autoencoders, AE):** 데이터 압축 및 특징 추출
- **변이형 오토인코더 (Variational Autoencoders, VAE):** 확률적 잠재 공간을 이용한 데이터 생성
- **생성적 적대 신경망 (Generative Adversarial Networks, GAN):**
  - 생성자(Generator)와 판별자(Discriminator)의 경쟁을 통한 학습
  - DCGAN, StyleGAN 등 주요 GAN 모델
- **디퓨전 모델 (Diffusion Models):** 노이즈를 점진적으로 제거하며 데이터 생성
- **응용 분야:** 이미지 생성, 스타일 변환(Style Transfer), 데이터 증강

### 4.7. 그래프 신경망 (Graph Neural Networks, GNN)
- **그래프 데이터의 이해:** 노드, 엣지, 그래프 구조
- **GNN의 기본 원리:** 메시지 전달(Message Passing)
- **주요 GNN 아키텍처:** GCN, GraphSAGE, GAT
- **응용 분야:** 추천 시스템, 소셜 네트워크 분석, 분자 구조 예측

## 파트 5: 강화학습 (Reinforcement Learning)

### 5.1. 강화학습 기초 (Fundamentals of Reinforcement Learning)
- **주요 구성요소:** 에이전트(Agent), 환경(Environment), 상태(State), 행동(Action), 보상(Reward)
- **정책 (Policy):** 상태에 따라 에이전트가 행동을 결정하는 방식 (π)
- **가치 함수 (Value Function):** 특정 상태 또는 상태-행동 쌍의 가치를 평가 (V-function, Q-function)
- **모델 (Model):** 환경이 어떻게 동작할지 예측 (상태 전이, 보상)
- **탐험과 활용의 딜레마 (Exploration vs. Exploitation Tradeoff)**

### 5.2. 마르코프 결정 과정 (Markov Decision Processes, MDP)
- **마르코프 속성 (Markov Property):** 현재 상태가 과거의 모든 정보를 포함
- **구성요소:** 상태(S), 행동(A), 상태 전이 확률(P), 보상 함수(R), 감가율(γ)
- **벨만 방정식 (Bellman Equations):**
  - **벨만 기대 방정식 (Bellman Expectation Equation):** 현재 가치와 다음 상태 가치의 관계
  - **벨만 최적 방정식 (Bellman Optimality Equation):** 최적 가치 함수를 찾기 위한 방정식

### 5.3. 주요 강화학습 알고리즘 (Key Reinforcement Learning Algorithms)

#### 5.3.1. 모델 프리 학습 (Model-Free Learning)
- 환경의 모델(상태 전이, 보상)을 모르는 상태에서 학습

#### 5.3.2. 가치 기반 학습 (Value-Based Learning)
- 최적 가치 함수를 학습하여 최적 정책을 유도
- **Q-러닝 (Q-Learning):** 오프-폴리시(Off-policy) 학습
- **SARSA (State-Action-Reward-State-Action):** 온-폴리시(On-policy) 학습
- **심층 Q-네트워크 (Deep Q-Network, DQN):** 신경망을 이용해 Q-함수를 근사
  - **Experience Replay, Target Network**

#### 5.3.3. 정책 기반 학습 (Policy-Based Learning)
- 최적 정책을 직접 학습
- **정책 경사 (Policy Gradient, PG):** 정책의 성능을 나타내는 목적 함수를 경사 상승법으로 최적화
- **REINFORCE 알고리즘**

#### 5.3.4. 액터-크리틱 (Actor-Critic Methods)
- 가치 기반과 정책 기반 학습의 결합
- **액터 (Actor):** 정책을 학습 (어떻게 행동할지 결정)
- **크리틱 (Critic):** 가치 함수를 학습 (액터가 한 행동을 평가)
- **A2C (Advantage Actor-Critic) / A3C (Asynchronous Advantage Actor-Critic)**
- **DDPG (Deep Deterministic Policy Gradient):** 연속적인 행동 공간에서 사용
- **SAC (Soft Actor-Critic)**

## 파트 6: MLOps (Machine Learning Operations)

### 6.1. MLOps 개요 (Introduction to MLOps)
- MLOps의 정의와 필요성
- DevOps와 MLOps의 차이점
- MLOps 파이프라인의 전체적인 그림

### 6.2. 데이터 및 피처 관리 (Data and Feature Management)
- **데이터 파이프라인:** ETL (Extract, Transform, Load), ELT
- **데이터 버전 관리 (Data Version Control, DVC):** 코드처럼 데이터셋 버전 관리
- **피처 스토어 (Feature Store):** 피처의 생성, 저장, 공유, 재사용을 위한 중앙 저장소

### 6.3. 모델 배포 및 서빙 (Model Deployment & Serving)
- **배포 전략:**
  - **Shadow Deployment:** 기존 모델과 새 모델을 병렬로 운영 (결과는 새 모델만 확인)
  - **Canary Deployment:** 일부 사용자에게만 새 모델을 노출
  - **A/B Testing:** 두 개 이상의 모델을 비교 평가
- **모델 서빙 (Model Serving):**
  - **REST API, gRPC**를 통한 모델 예측 서비스 제공
  - **온라인 서빙 (Online Serving) vs. 배치 서빙 (Batch Serving)**
- **컨테이너화 (Containerization):**
  - **Docker:** 재현 가능한 환경 구축
  - **Kubernetes (K8s):** 컨테이너 오케스트레이션, 확장성 및 안정성 확보
- **서버리스 (Serverless) 배포:** AWS Lambda, Google Cloud Functions

### 6.4. CI/CD/CT for ML
- **CI (Continuous Integration):** 코드 변경 사항의 자동화된 빌드 및 테스트
- **CD (Continuous Delivery/Deployment):** 모델의 자동화된 배포
- **CT (Continuous Training):** 새로운 데이터나 성능 저하 시 모델 재학습 자동화

### 6.5. 모델 모니터링 및 관리 (Model Monitoring & Management)
- **모델 성능 모니터링:** 예측 성능, 지연 시간, 처리량 등 추적
- **데이터 드리프트 (Data Drift):** 입력 데이터의 통계적 분포 변화
- **컨셉 드리프트 (Concept Drift):** 입력 데이터와 타겟 변수 간의 관계 변화
- **모델 레지스트리 (Model Registry):** 훈련된 모델의 버전, 아티팩트, 메타데이터 관리
- **주요 MLOps 플랫폼:** MLflow, Kubeflow, TFX, Sagemaker

## 파트 7: 심화 주제 및 전문 분야 (Advanced Topics & Specializations)

### 7.1. 자연어 처리 심화 (Advanced Natural Language Processing, NLP)
- **텍스트 임베딩 (Text Embeddings):**
  - **Word2Vec, GloVe, FastText:** 단어 수준의 벡터 표현
  - **Contextual Embeddings:** ELMo, BERT, GPT
- **주요 NLP 과제:**
  - **감성 분석 (Sentiment Analysis)**
  - **개체명 인식 (Named Entity Recognition, NER)**
  - **토픽 모델링 (Topic Modeling):** Latent Dirichlet Allocation (LDA)
  - **기계 번역 (Machine Translation)**
  - **텍스트 요약 (Text Summarization)**
  - **질의응답 시스템 (Question Answering Systems)**

### 7.2. 컴퓨터 비전 심화 (Advanced Computer Vision, CV)
- **전이 학습 (Transfer Learning) 및 미세 조정 (Fine-tuning):** 사전 훈련된 모델 활용
- **이미지 생성 (Image Generation) 및 스타일 변환 (Style Transfer)**
- **Semantic/Instance Segmentation 심화**
- **3D 비전 (3D Vision)**
- **비디오 분석 (Video Analysis)**

### 7.3. 추천 시스템 (Recommender Systems)
- **콘텐츠 기반 필터링 (Content-Based Filtering)**
- **협업 필터링 (Collaborative Filtering):**
  - **최근접 이웃 기반 (Neighborhood-based)**
  - **잠재 요인 모델 (Latent Factor Models):** 행렬 분해 (Matrix Factorization), SVD
- **딥러닝 기반 추천 시스템 (Deep Learning-based Recommender Systems)**
- **하이브리드 모델 (Hybrid Models)**

### 7.4. 시계열 분석 (Time Series Analysis)
- **전통적 시계열 모델:**
  - **AR (Autoregressive), MA (Moving Average), ARMA, ARIMA, SARIMA**
- **딥러닝 기반 시계열 모델:**
  - **RNNs, LSTMs, GRUs for Time Series Forecasting**
- **기타 모델:** Facebook Prophet, N-BEATS

### 7.5. 책임감 있고 윤리적인 AI (Responsible & Ethical AI)
- **AI의 편향성과 공정성 (Bias and Fairness in AI):**
  - 편향의 종류와 탐지 방법
  - 공정성 지표 및 완화 기법
- **설명 가능한 AI (Explainable AI, XAI):**
  - 모델의 예측을 인간이 이해할 수 있도록 설명
  - **LIME (Local Interpretable Model-agnostic Explanations)**
  - **SHAP (SHapley Additive exPlanations)**
- **프라이버시 보호 (Privacy in AI):**
  - **연합 학습 (Federated Learning)**
  - **차등 정보보호 (Differential Privacy)**
- **AI 안전성 (AI Safety):** AI 시스템의 의도치 않은 행동 방지
