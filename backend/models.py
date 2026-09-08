from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class Bus(Base):
    __tablename__ = "buses"

    id = Column(String, primary_key=True, index=True) # e.g. BUS-001
    bus_number = Column(String, index=True) # e.g. TN-38-N-2401
    route_id = Column(String, ForeignKey("routes.id"))
    latitude = Column(Float)
    longitude = Column(Float)
    speed = Column(Float, default=30.0)
    status = Column(String, default="active") # active, idle, offline, warning
    gps_status = Column(String, default="locked")
    camera_status = Column(String, default="online")
    ai_status = Column(String, default="online")
    fps = Column(Float, default=28.6)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)

    route = relationship("Route", back_populates="buses")
    detections = relationship("Detection", back_populates="bus")

class Route(Base):
    __tablename__ = "routes"

    id = Column(String, primary_key=True, index=True) # e.g. R-12
    route_number = Column(String, index=True)
    name = Column(String)
    path = Column(Text) # JSON string of coordinates

    buses = relationship("Bus", back_populates="route")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

class Detection(Base):
    __tablename__ = "detections"

    id = Column(String, primary_key=True, index=True) # e.g. DET-2026-00128
    type = Column(String, index=True) # pothole, road_damage, waterlogging, congestion, pedestrian_risk
    confidence = Column(Float)
    severity = Column(String, index=True) # low, medium, high, critical
    latitude = Column(Float)
    longitude = Column(Float)
    location_name = Column(String)
    bus_id = Column(String, ForeignKey("buses.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    evidence_image = Column(String)
    status = Column(String, default="pending_verification", index=True) # pending_verification, verified, assigned, in_progress, resolved, rejected
    department = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    bus = relationship("Bus", back_populates="detections")
    history = relationship("IncidentHistory", back_populates="detection")

class IncidentHistory(Base):
    __tablename__ = "incident_history"

    id = Column(Integer, primary_key=True, index=True)
    detection_id = Column(String, ForeignKey("detections.id"))
    previous_status = Column(String)
    new_status = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    changed_by = Column(String)
    note = Column(String, nullable=True)

    detection = relationship("Detection", back_populates="history")
