
import torch.nn as nn
import torch.nn.functional as F

class Model(nn.Module):
    def __init__(self, inputs=400, h1=128, h2=64, output=4):
        super().__init__()
        self.fc1 = nn.Linear(inputs, h1)
        self.fc2 = nn.Linear(h1, h2)
        self.out = nn.Linear(h2, output)

    def forward(self, x):
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = self.out(x)
        return x
