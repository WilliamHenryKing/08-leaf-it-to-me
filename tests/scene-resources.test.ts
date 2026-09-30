import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { SceneLifetime } from "../src/scene/lifetime";
import { SceneResources } from "../src/scene/resources";

describe("scene resource and async lifetimes", () => {
  test("custom water maps are disposed before shader compilation, with shared resources once", () => {
    const resources = new SceneResources();
    const map = new THREE.Texture();
    const normal = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map });
    material.userData.shaderUniforms = { uFlow: { value: normal }, uNoise: { value: map } };
    const geometry = new THREE.PlaneGeometry();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
    let maps = 0;
    let normals = 0;
    let materials = 0;
    let geometries = 0;
    map.addEventListener("dispose", () => maps++);
    normal.addEventListener("dispose", () => normals++);
    material.addEventListener("dispose", () => materials++);
    geometry.addEventListener("dispose", () => geometries++);
    resources.tree(group);
    resources.dispose();
    resources.dispose();
    expect([maps, normals, materials, geometries]).toEqual([1, 1, 1, 1]);
  });

  test("teardown releases late decoded image resources and closes shared bitmaps once", () => {
    const resources = new SceneResources();
    let closed = 0;
    const bitmap = { close: () => closed++ };
    const texture = new THREE.Texture(bitmap);
    const clone = texture.clone();
    let released = 0;
    texture.addEventListener("dispose", () => released++);
    clone.addEventListener("dispose", () => released++);
    resources.own(texture);
    resources.dispose();
    resources.own(clone);
    resources.own(clone);
    expect(closed).toBe(1);
    expect(released).toBe(2);
  });

  test("disposing one world does not dispose another world's texture", () => {
    const first = new SceneResources();
    const second = new SceneResources();
    const a = first.own(new THREE.Texture());
    const b = second.own(new THREE.Texture());
    let disposedA = 0;
    let disposedB = 0;
    a.addEventListener("dispose", () => disposedA++);
    b.addEventListener("dispose", () => disposedB++);
    first.dispose();
    expect([disposedA, disposedB]).toEqual([1, 0]);
    second.dispose();
    expect([disposedA, disposedB]).toEqual([1, 1]);
  });

  test("abort settles pending shader/load waits and consumes late failures", async () => {
    const external = new AbortController();
    const lifetime = new SceneLifetime(external.signal);
    let rejectJob: (error: Error) => void = () => {};
    const job = new Promise<void>((_, reject) => {
      rejectJob = reject;
    });
    const waiting = lifetime.wait(job);
    external.abort();
    await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
    rejectJob(new Error("late compile error"));
    await Promise.resolve();
    lifetime.dispose();
    expect(lifetime.signal.aborted).toBe(true);
    expect(() => lifetime.assertAlive()).toThrow("World disposed");
  });
});
