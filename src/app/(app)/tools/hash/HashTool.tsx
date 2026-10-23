"use client";

import { useState } from "react";
import { hashPassword } from "../actions";
import { Button, Input, Label } from "@/components/ui";
import { Generator } from "@/components/Generator";
import { ShadowHash } from "@/components/ShadowHash";

export function HashTool() {
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [show, setShow] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Label>
        password
        <div className="flex gap-2">
          <Input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            className="font-mono"
          />
          <Button type="button" variant="secondary" onClick={() => setShow((s) => !s)}>
            {show ? "hide" : "peek"}
          </Button>
        </div>
      </Label>
      <Generator
        onGenerate={(v) => {
          setPassword(v);
          setShow(true);
        }}
      />
      <Label>
        username (optional, fills in the commands)
        <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" placeholder="root" />
      </Label>
      <ShadowHash input={password} username={username} disabled={!password} getHash={(cost) => hashPassword(password, cost)} />
    </div>
  );
}
