import React, { useMemo, useRef, useState } from 'react'
import { pageAtom, pages } from './UI';
import { Bone, BoxGeometry, Float32BufferAttribute, MathUtils, MeshStandardMaterial, Skeleton, SkeletonHelper, SkinnedMesh, SRGBColorSpace, Uint16BufferAttribute, Vector3 } from 'three';
import { useHelper, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { degToRad } from 'three/src/math/MathUtils.js';
import { useAtom } from 'jotai';
import { easing } from 'maath';

const easingFactor = 0.5;
const insideCurveStrength = 0.18;
const outsideCurveStrength = 0.05;
const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.73;
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

const pageGeomentry = new BoxGeometry(
    PAGE_WIDTH,
    PAGE_HEIGHT,
    PAGE_DEPTH,
    PAGE_SEGMENTS,
    2
);
pageGeomentry.translate(PAGE_WIDTH / 2, 0, 0);

const position = pageGeomentry.attributes.position;
const vertex = new Vector3();
const skinIndexes = []
const skinWeights = []

for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const x = vertex.x;

    const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH));
    let skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;

    skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
    skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
}

pageGeomentry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndexes, 4));
pageGeomentry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));

const whiteColor = 0xffffff;

const pageMaterials = [
    new MeshStandardMaterial({
        color: whiteColor,
    }),
    new MeshStandardMaterial({
        color: '#111',
    }),
    new MeshStandardMaterial({
        color: whiteColor,
    }),
    new MeshStandardMaterial({
        color: whiteColor,
    }),
]

pages.forEach(page => {
    useTexture.preload(`textures/${page.front}.jpg`),
        useTexture.preload(`textures/${page.back}.jpg`),
        useTexture.preload(`textures/book-cover-roughness.jpg`)
})

const Page = ({ number, front, back, page, opened, bookClosed, ...props }) => {
    const group = useRef();
    const skinnedMeshRef = useRef();

    const [picture, picture2, pictureRoughness] = useTexture([
        `/textures/${front}.jpg`,
        `/textures/${back}.jpg`,
        ...(number === 0 || number === pages.length - 1 ?
            [`textures/book-cover-roughness.jpg`] : []
        )
    ])

    picture.colorSpace = picture2.colorSpace = SRGBColorSpace

    const manualSkinnedMesh = useMemo(() => {
        const bones = [];
        for (let i = 0; i <= PAGE_SEGMENTS; i++) {
            let bone = new Bone();
            bones.push(bone);
            if (i == 0) {
                bone.position.x = 0;
            } else {
                bone.position.x = SEGMENT_WIDTH;
            }
            if (i > 0) {
                bones[i - 1].add(bone);
            }
        }
        const skeleton = new Skeleton(bones);
        const materials = [...pageMaterials,
        new MeshStandardMaterial({
            color: whiteColor,
            map: picture,
            ...(number === 0
                ? { roughnessMap: pictureRoughness } :
                { roughness: 0.1 }
            )
        }),
        new MeshStandardMaterial({
            color: whiteColor,
            map: picture2,
            ...(number === pages.length - 1
                ? { roughnessMap: pictureRoughness } :
                { roughness: 0.1 }
            )
        })
        ];
        const mesh = new SkinnedMesh(pageGeomentry, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.add(skeleton.bones[0]);
        mesh.bind(skeleton);
        return mesh;
    }, []);

    // useHelper(skinnedMeshRef, SkeletonHelper,'red');

    useFrame((_, delta) => {
        if (!skinnedMeshRef.current) return;

        let targetRotation = opened ? - Math.PI / 2 : Math.PI / 2;
        if (!bookClosed) {
            targetRotation += degToRad(number * 0.8);
        }

        const bones = skinnedMeshRef.current.skeleton.bones;
        // bones[0].rotation.y = targetRotation;
        // bones[0].rotation.y = MathUtils.lerp(
        //     bones[0].rotation.y,
        //     targetRotation,
        //     0.05,
        //     delta
        // );  
        for (let i = 0; i < bones.length; i++) {
            const target = i === 0 ? group.current : bones[i];
            const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
            const outsideCurveIntensity = i > 8 ? Math.cos(i * 0.3 + 0.09) : 0;
            let rotationAngle =
                insideCurveStrength * insideCurveIntensity * targetRotation -
                outsideCurveStrength * outsideCurveIntensity * targetRotation;

            if (bookClosed) {
                if (i === 0) {
                    rotationAngle = targetRotation;
                } else {
                    rotationAngle = 0;
                }
            }
            easing.dampAngle(
                target.rotation,
                "y",
                rotationAngle,
                easingFactor,
                delta
            );
        }
    })

    return (
        <group ref={group} {...props}>
            <primitive
                object={manualSkinnedMesh}
                ref={skinnedMeshRef}
                position-z={-number * PAGE_DEPTH + page * PAGE_DEPTH}
            />
        </group>);
}

const Book = (props) => {
    const [page] = useAtom(pageAtom);

    return (
        <group {...props}>
            {
                [...pages.map((pageData, index) => (
                    <Page
                        // position-x={index * 0.15} 
                        key={index}
                        number={index}
                        page={page}
                        {...pageData}
                        opened={page > index}
                        bookClosed={page === 0 || page === pages.length}
                    />
                ))]
            }
        </group>
    )
}

export default Book;


//squoosh.app (# for book size)