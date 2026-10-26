"""Draws the use case diagram (docs/uml/use_case_diagram.png) with matplotlib."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch

fig, ax = plt.subplots(figsize=(17, 12.5))
ax.set_xlim(0, 17); ax.set_ylim(0, 12.6); ax.axis("off")
BLUE, FILL = "#2b5797", "#eef3fb"

ax.add_patch(FancyBboxPatch((3.0, 0.6), 11, 11.4, boxstyle="round,pad=0.05,rounding_size=0.3", fc="white", ec=BLUE, lw=1.8))
ax.text(8.5, 11.7, "Campus Service Request Management System", ha="center", fontsize=14, color=BLUE, weight="bold")

def actor(x, y, name):
    ax.add_patch(plt.Circle((x, y + 0.55), 0.18, fill=False, lw=1.6))
    ax.plot([x, x], [y + 0.37, y - 0.15], "k", lw=1.6)
    ax.plot([x - 0.3, x + 0.3], [y + 0.2, y + 0.2], "k", lw=1.6)
    ax.plot([x, x - 0.25], [y - 0.15, y - 0.55], "k", lw=1.6)
    ax.plot([x, x + 0.25], [y - 0.15, y - 0.55], "k", lw=1.6)
    ax.text(x, y - 0.85, name, ha="center", va="top", fontsize=11, weight="bold")
    return (x, y)

UC = {}
def usecase(key, x, y, label, dashed=False):
    ax.add_patch(Ellipse((x, y), 3.3, 0.62, fc=FILL, ec=BLUE, lw=1.3, ls="--" if dashed else "-"))
    ax.text(x, y, label, ha="center", va="center", fontsize=9.5)
    UC[key] = (x, y)

A, B = 6.4, 10.8
for i, (k, t) in enumerate([("reg", "Register user"), ("sub", "Submit service request"), ("vid", "View request by ID"),
                            ("vmy", "View my requests"), ("upd", "Update my Submitted request"), ("can", "Cancel my Submitted request"),
                            ("sea", "Search requests"), ("sum", "View status summary")]):
    usecase(k, A, 11.0 - i * 0.78, t)
for i, (k, t) in enumerate([("rev", "Review request"), ("pri", "Set priority"), ("asg", "Assign Technician"), ("clo", "Verify and close request")]):
    usecase(k, A, 4.55 - i * 0.78, t)
for i, (k, t) in enumerate([("vas", "View assigned requests"), ("sta", "Start work"), ("not", "Add progress note"), ("res", "Resolve request")]):
    usecase(k, B, 11.0 - i * 0.78, t)
usecase("his", B, 7.4, "View request history")
usecase("fil", B, 6.6, "Filter and sort requests")
usecase("rep", B, 4.55, "Generate management reports")
usecase("aud", B, 3.77, "View audit log")
usecase("val", 6.4, 1.35, "Validate input", dashed=True)
usecase("sav", 10.8, 1.35, "Save to JSON files", dashed=True)

req = actor(1.3, 8.6, "Student / Staff\nRequester")
off = actor(1.3, 3.6, "Service Officer")
tec = actor(15.7, 9.4, "Technician")
adm = actor(15.7, 4.2, "System\nAdministrator")

def link(act, key, side):
    x, y = UC[key]
    ex = x - 1.65 if side == "L" else x + 1.65
    sx = act[0] + (0.35 if side == "L" else -0.35)
    ax.plot([sx, ex], [act[1], y], color="#555", lw=0.9)

for k in ["reg", "sub", "vid", "vmy", "upd", "can", "sea", "sum"]: link(req, k, "L")
for k in ["rev", "pri", "asg", "clo", "sea"]: link(off, k, "L")
for k in ["vas", "sta", "not", "res", "fil", "his"]: link(tec, k, "R")
for k in ["rep", "aud", "his", "fil"]: link(adm, k, "R")
# Requester and officer reach use cases in column B: route via the left edge of the ellipse.
for act, k in [(req, "his"), (off, "his"), (off, "fil"), (off, "rep")]:
    x, y = UC[k]
    ax.plot([act[0] + 0.35, x - 1.65], [act[1], y], color="#555", lw=0.9)

def include(src, dst):
    (x1, y1), (x2, y2) = UC[src], UC[dst]
    ax.annotate("", xy=(x2, y2 + 0.31), xytext=(x1, y1 - 0.31),
                arrowprops=dict(arrowstyle="->", ls="--", color="#888", lw=0.9))
    ax.text((x1 + x2) / 2, (y1 + y2) / 2, "«include»", fontsize=7.5, color="#666", ha="center",
            bbox=dict(fc="white", ec="none", pad=0.5))

ax.text(8.5, 0.15, "«include»: every use case that creates or changes data (register, submit, update, cancel, review, set priority, assign, start, note, resolve, close) includes 'Validate input' and 'Save to JSON files'.",
        ha="center", fontsize=8.5, color="#555", style="italic")
plt.savefig("use_case_diagram.png", dpi=150, bbox_inches="tight", facecolor="white")
