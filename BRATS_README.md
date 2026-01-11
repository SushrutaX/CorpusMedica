# BraTS Segmentation Logic (Plain-English Guide)

This document explains the BraTS brain tumor segmentation logic used in this project,
including terms, model behavior, and how outputs are produced.

## 1) What BraTS Is
BraTS is a public research dataset and benchmark for brain tumor segmentation.
Models trained on BraTS learn to label tumor regions in multi-modal MRI scans.

## 2) What the Model Expects (Inputs)
BraTS models require four MRI modalities of the same patient, aligned to the same grid:
- **T1**: structural MRI (anatomy)
- **T1ce**: T1 with contrast (highlights active tumor)
- **T2**: highlights fluid and edema
- **FLAIR**: suppresses fluid signal and emphasizes lesions

All four must be:
- the same shape (same voxel grid),
- the same orientation and affine,
- aligned to each other (co-registered).

## 3) What a Voxel Is
A **voxel** is a 3D pixel.  
Your MRI is a 3D grid of voxels, and each voxel has an intensity value.

Example:
- If the scan shape is `(240, 240, 160)`, that means the brain volume is made of
  240 x 240 x 160 tiny cubes (voxels).

## 4) What the Model Predicts (Overview)
The model produces two things:
1) **Internal probability maps** (not saved directly).
2) **A final segmentation mask** saved to disk.

## 5) What the Model Predicts (Detailed)
Inside the network, the output is **three channels**:
1) **Core**: necrotic / non-enhancing tumor core
2) **Edema**: peritumoral edema
3) **Enhancing tumor**

Each voxel gets three scores, one per channel. After the sigmoid step, each score
is between 0 and 1 and represents how likely that voxel belongs to that region.

## 6) How the Final Label Is Chosen (Label Logic)
The BraTS bundle turns the three probability maps into a single label volume:
1) Each channel is thresholded (0.5 by default).
2) If multiple channels are "on" for a voxel, a priority rule is used:
   - Enhancing tumor -> label 4
   - Else core -> label 1
   - Else edema -> label 2
   - Else background -> label 0

This logic matches the postprocessing rules in the bundle config.

## 7) Label Meanings (In More Detail)
The labels correspond to clinically meaningful sub-regions:

- **Label 0 (Background)**  
  Normal brain tissue and everything that is not tumor.

- **Label 1 (Necrotic / non-enhancing core)**  
  The inner core of the tumor that is not actively enhancing after contrast.  
  Often includes necrotic (dead) tissue and non-enhancing tumor regions.

- **Label 2 (Peritumoral edema)**  
  The swollen tissue around the tumor, caused by fluid leakage and inflammation.  
  This region can be large and diffuse, spreading into surrounding brain.

- **Label 4 (Enhancing tumor)**  
  The actively growing part of the tumor that takes up contrast agent.  
  This usually appears bright on T1ce scans.

These labels are not arbitrary. They reflect how different tumor regions
appear across MRI modalities and how radiologists describe them.

## 8) Why Labels Are 1, 2, 4
BraTS uses the label set `{0, 1, 2, 4}` historically.  
It makes it easy to combine regions:
- **Whole Tumor (WT)** = labels 1 + 2 + 4
- **Tumor Core (TC)** = labels 1 + 4
- **Enhancing Tumor (ET)** = label 4 only

## 9) Pipeline Logic (Step-by-Step)
1) **Load inputs**
   - 4 MRI volumes are loaded and stacked into a 4-channel volume.

2) **Normalize intensities**
   - Each channel is normalized so values are on similar scales.

3) **Run the neural network**
   - The model is a 3D CNN (SegResNet).
   - It learns spatial and intensity patterns across the 4 channels.

4) **Sliding window inference**
   - Large scans are processed in overlapping 3D patches.
   - Patch outputs are stitched into a full-size prediction.
   - This avoids GPU memory issues on full volumes.

5) **Post-processing**
   - Probabilities are thresholded.
   - Labels are assigned with the priority rule.
   - The final mask is saved to disk.

## 10) How the Model "Finds" Tumor (Simple Explanation)
The model learns from many examples with expert-labeled masks.
It does not use rules; it learns patterns:
- Tumor tissue looks different across T1, T1ce, T2, and FLAIR.
- The model combines those patterns to classify each voxel.

In simple terms, it asks:
"Does this voxel look like tumor core?"
"Does it look like edema?"
"Does it look like enhancing tumor?"

## 11) What `model.pt` Contains
`model.pt` is the trained **weights** of the neural network.
It is not the code itself. The code is in MONAI (SegResNet), and the `.pt`
file is the learned parameters that make the model work.

## 12) Output Files
After inference, you get:
- **Mask file**: `*_seg.nii.gz` (3D labeled volume)
- **Report file**: `report.json` (metadata + computed volume)

The mask can be visualized in 3D Slicer or ITK-SNAP by overlaying it on the input scan.

## 13) Accuracy and Evaluation
To measure accuracy, you need a **ground-truth mask**.
With ground-truth, you can compute metrics like Dice score.
Without ground-truth, you can only visually inspect the mask overlay.

## 14) Common Input Issues
- **Wrong modalities** (e.g., T1/T2 only): model expects 4 channels.
- **Misaligned scans**: shapes and affines must match.
- **Low-quality scans**: model performance may degrade.

## 15) Disclaimer
These models are for research and decision support only.
They are not medical devices and should not be used for clinical diagnosis.
