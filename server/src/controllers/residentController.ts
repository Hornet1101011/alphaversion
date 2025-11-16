import { Request, Response } from 'express';
import { Resident, IResident } from '../models/Resident';
import { Log } from '../models/Log'; // Import the Log model

export const getAllResidents = async (req: Request, res: Response) => {
  const residents = await Resident.find();
  res.json(residents);
};

export const addResident = async (req: Request, res: Response) => {
  const resident = new Resident(req.body);
  await resident.save();
  res.status(201).json(resident);
};

export const updateResident = async (req: Request, res: Response) => {
  try {
    const resident = await Resident.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!resident) return res.status(404).json({ message: 'Resident not found' });
    res.json(resident);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ message: errorMessage });
  }
};

export const deleteResident = async (req: Request, res: Response) => {
  await Resident.findByIdAndDelete(req.params.id);
  // Audit log for resident deletion
  await Log.create({
    type: 'audit',
    message: 'Resident deleted',
    details: `Resident ID: ${req.params.id}, Deleted by: ${(req as any).user._id}`,
    actor: String((req as any).user._id),
    target: String(req.params.id)
  });
  res.status(204).end();
};
