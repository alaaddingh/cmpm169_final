import sys
import pygame
import torch
from torch.distributions import Categorical
from machine import Model

import uuid
print("Brain ID:", uuid.uuid4())

# ---------- Pygame setup ----------
pygame.init()

WIDTH, HEIGHT = 800, 400
WIN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Robot Keyboard Player")

CLOCK = pygame.time.Clock()

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GREEN = (0, 200, 0)
RED   = (200, 0, 0)

# Player
PLAYER_WIDTH, PLAYER_HEIGHT = 40, 60
player = pygame.Rect(50, HEIGHT - PLAYER_HEIGHT - 50, PLAYER_WIDTH, PLAYER_HEIGHT)

player_vel_y = 0.0
GRAVITY = 0.6
GROUND_Y = HEIGHT - 50

MOVE_SPEED = 5
JUMP_SPEED = -12

# Finish line
FINISH_WIDTH = 20
finish_line = pygame.Rect(WIDTH - 100, GROUND_Y - 100, FINISH_WIDTH, 100)

font = pygame.font.SysFont(None, 32)

# ---------- Robot (neural net) ----------
# 1 input (x position), 3 outputs (left, right, jump)
model = Model(inputs=1, output=3)
model.train()  # we ARE training

optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

ACTIONS = ["left", "right", "jump"]


def get_robot_action_and_logprob():
    """Return (action_str, log_prob_tensor) for the current state."""
    x_norm = player.centerx / WIDTH  # 0–1
    state = torch.tensor([[x_norm]], dtype=torch.float32)  # shape (1, 1)

    logits = model(state)          # (1, 3)
    probs = torch.softmax(logits, dim=1)

    dist = Categorical(probs)
    action_idx = dist.sample()
    log_prob = dist.log_prob(action_idx)

    action = ACTIONS[action_idx.item()]
    return action, log_prob


def draw_window(win_text=None, episode=None, elapsed=None, reward=None):
    WIN.fill(WHITE)

    pygame.draw.rect(WIN, BLACK, (0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y))
    pygame.draw.rect(WIN, GREEN, finish_line)
    pygame.draw.rect(WIN, RED, player)

    # HUD
    hud_parts = []
    if episode is not None:
        hud_parts.append(f"Episode: {episode}")
    if elapsed is not None:
        hud_parts.append(f"Time: {elapsed:4.1f}s")
    if reward is not None:
        hud_parts.append(f"Reward: {reward:.3f}")
    if hud_parts:
        hud_text = "   ".join(hud_parts)
        WIN.blit(font.render(hud_text, True, BLACK), (10, 10))

    if win_text:
        text_surf = font.render(win_text, True, BLACK)
        rect = text_surf.get_rect(center=(WIDTH // 2, HEIGHT // 2))
        WIN.blit(text_surf, rect)

    pygame.display.flip()


def reset_player():
    global player, player_vel_y
    player.x = 50
    player.y = HEIGHT - PLAYER_HEIGHT - 50
    player_vel_y = 0.0


def main():
    global player_vel_y

    running = True
    episode = 1
    max_seconds = 10.0

    while running:
        reset_player()
        won = False
        start_ms = pygame.time.get_ticks()

        log_probs = []
        time_to_target = None      # first time reward >= 0.8
        num_jumps = 0              # 🔹 track jumps this episode

        while running:
            CLOCK.tick(60)

            now_ms = pygame.time.get_ticks()
            elapsed = (now_ms - start_ms) / 1000.0

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False

            if not running:
                break

            # ------------ ACTION ------------
            action, log_prob = get_robot_action_and_logprob()
            log_probs.append(log_prob)

            if action == "left":
                player.x -= MOVE_SPEED
            elif action == "right":
                player.x += MOVE_SPEED

            on_ground = player.bottom >= GROUND_Y
            if on_ground:
                player.bottom = GROUND_Y
                if action == "jump":
                    player_vel_y = JUMP_SPEED
                    num_jumps += 1          # 🔹 count jumps

            # ------------ PHYSICS ------------
            player_vel_y += GRAVITY
            player.y += player_vel_y

            if player.bottom > GROUND_Y:
                player.bottom = GROUND_Y
                player_vel_y = 0.0

            if player.left < 0:
                player.left = 0
            if player.right > WIDTH:
                player.right = WIDTH

            if player.colliderect(finish_line):
                won = True

            # ------------ REWARD (instant) ------------
            x_norm = player.centerx / WIDTH
            reward = x_norm  # 0..1

            # record first time we cross 0.8
            if reward >= 0.8 and time_to_target is None:
                time_to_target = elapsed

            # Draw frame
            if won:
                draw_window("Robot reached the finish!", episode, elapsed, reward)
            else:
                draw_window(None, episode, elapsed, reward)

            # ------------ END OF EPISODE ------------
            if won or elapsed >= max_seconds:
                final_x_norm = player.centerx / WIDTH

                # speed bonus for hitting 0.8 earlier
                if time_to_target is not None:
                    speed_bonus = 1.0 - (time_to_target / max_seconds)  # 0..1
                else:
                    speed_bonus = 0.0

                # 🔹 jump penalty
                jump_penalty = 0.001 * num_jumps   # tune this if too strong/weak

                # 🔹 shaped reward:
                # - reward distance
                # - bonus if it got to 0.8 quickly
                # - penalty for spam jumping
                final_reward = final_x_norm + 0.5 * speed_bonus - jump_penalty
                final_reward = max(final_reward, 0.0)

                # ---- REINFORCE UPDATE ----
                if log_probs:
                    log_probs_tensor = torch.stack(log_probs)
                    loss = -final_reward * log_probs_tensor.mean()

                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()

                print(
                    f"Episode {episode} ended. "
                    f"Won: {won}, Time: {elapsed:.2f}s, "
                    f"x_norm: {final_x_norm:.3f}, "
                    f"Reward: {final_reward:.3f}, "
                    f"Jumps: {num_jumps}"
                )

                pygame.time.delay(400)
                episode += 1
                break

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
