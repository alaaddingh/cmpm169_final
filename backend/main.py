# run as: python -m backend.main

from .machine import Model
import torch
from torch.distributions import Categorical


def encode_grid(snapshot):
    grid_size = 10
    n_channels = 4
    input_size = grid_size * grid_size * n_channels

    if not snapshot or not isinstance(snapshot, (list, tuple)):
        flat_vec = [1.0, 0.0, 0.0, 0.0] * (grid_size * grid_size)
        return torch.tensor(flat_vec, dtype=torch.float32).unsqueeze(0)

    onehot_map = {
        "X": (1.0, 0.0, 0.0, 0.0),
        "F": (0.0, 1.0, 0.0, 0.0),
        "P": (0.0, 0.0, 1.0, 0.0),
        "B": (0.0, 0.0, 0.0, 1.0),
    }

    flat_vec = []
    for row in snapshot:
        for ch in row:
            flat_vec.extend(onehot_map.get(ch, (1.0, 0.0, 0.0, 0.0)))

    if len(flat_vec) < input_size:
        flat_vec.extend([0.0] * (input_size - len(flat_vec)))
    elif len(flat_vec) > input_size:
        flat_vec = flat_vec[:input_size]

    return torch.tensor(flat_vec, dtype=torch.float32).unsqueeze(0)


def run(model_obj, grid_snapshot, reward: float = 0.0):
    if reward is None:
        reward = 0.0
    reward = float(max(min(reward, 10.0), -10.0))

    print("Reward:", reward)

    if not hasattr(model_obj, "optim"):
        model_obj.optim = torch.optim.Adam(model_obj.parameters(), lr=1e-3)
    if not hasattr(model_obj, "last_logprob"):
        model_obj.last_logprob = None

    if model_obj.last_logprob is not None:
        loss = -reward * model_obj.last_logprob
        model_obj.optim.zero_grad()
        loss.backward()
        model_obj.optim.step()
        model_obj.last_logprob = None

    encoded = encode_grid(grid_snapshot)
    nn_decision = model_obj(encoded)
    actions = ["up", "back", "down", "forward"]
    probs = torch.softmax(nn_decision, dim=1)
    dist = Categorical(probs)
    action_idx = dist.sample().item()
    action = actions[action_idx]
    print("Chosen action:", action)
    model_obj.last_logprob = dist.log_prob(torch.tensor(action_idx))
    return action


if __name__ == "__main__":
    temp_model = Model()
    temp_grid = []
    run(temp_model, temp_grid, 0.0)
