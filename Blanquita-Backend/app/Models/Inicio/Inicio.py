from pydantic import BaseModel


class MotivoPausaInicio(BaseModel):
    Motivo: str
    Pausas: int
    Segundos: int
